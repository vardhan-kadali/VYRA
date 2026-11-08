import json
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session

from app.models.interview import (
    InterviewSession,
    InterviewExchange,
    InterviewEvaluation,
    SessionStatus,
)
from app.models.document import Document, DocumentChunk
from app.ai.ollama_client import OllamaAIProvider, ollama_ai_provider, OllamaUnavailableError
from app.pdf.retriever import retrieve_relevant_chunks, format_retrieved_context_for_prompt

class InterviewEngineError(Exception):
    pass

class InterviewEngine:
    def __init__(self, ai_provider: Optional[OllamaAIProvider] = None):
        self.ai = ai_provider or ollama_ai_provider

    def create_session(
        self,
        db: Session,
        topic: str,
        category: str,
        subject: Optional[str] = None,
        difficulty: str = "intermediate",
        duration_minutes: int = 15,
        document_id: Optional[str] = None
    ) -> InterviewSession:
        """Validates configuration and creates initial session record."""
        # Validate document if provided
        if document_id:
            doc = db.query(Document).filter(Document.id == document_id).first()
            if not doc:
                raise InterviewEngineError(f"Document with ID {document_id} not found.")

        session_id = str(uuid.uuid4())
        session = InterviewSession(
            id=session_id,
            topic=topic.strip(),
            category=category.strip(),
            subject=subject.strip() if subject else None,
            difficulty=difficulty.strip(),
            duration_minutes=duration_minutes,
            document_id=document_id,
            status=SessionStatus.READY.value,
            created_at=datetime.utcnow()
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    def _get_document_chunks_dict(self, db: Session, document_id: str) -> List[Dict[str, Any]]:
        """Loads all chunks for a document as list of dicts."""
        chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).order_by(DocumentChunk.chunk_index).all()
        return [
            {
                "page_number": c.page_number,
                "chunk_index": c.chunk_index,
                "chunk_text": c.chunk_text,
                "char_count": c.char_count
            }
            for c in chunks
        ]

    async def start_session(self, db: Session, session_id: str) -> InterviewExchange:
        """Transitions session to IN_PROGRESS and generates Question 1."""
        session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
        if not session:
            raise InterviewEngineError(f"Session {session_id} not found.")

        if session.status not in (SessionStatus.CREATED.value, SessionStatus.READY.value):
            # If already started, return existing exchange
            existing_first = db.query(InterviewExchange).filter(
                InterviewExchange.session_id == session_id,
                InterviewExchange.question_number == 1
            ).first()
            if existing_first:
                return existing_first
            raise InterviewEngineError(f"Session is already in status: {session.status}")

        session.status = SessionStatus.IN_PROGRESS.value
        session.started_at = datetime.utcnow()

        document_context = None
        page_ref = None

        if session.document_id:
            chunks_data = self._get_document_chunks_dict(db, session.document_id)
            relevant_chunks = retrieve_relevant_chunks(session.topic, chunks_data, top_k=3)
            document_context, page_ref = format_retrieved_context_for_prompt(relevant_chunks)

        # Generate Q1 via AI provider
        q1_data = await self.ai.generate_first_question(
            topic=session.topic,
            category=session.category,
            difficulty=session.difficulty,
            subject=session.subject,
            document_context=document_context,
            page_ref=page_ref
        )

        question_text = q1_data.get("question", f"Could you begin by explaining your foundational understanding of {session.topic}?")
        supporting_page = q1_data.get("page_ref", page_ref)

        exchange = InterviewExchange(
            session_id=session.id,
            question_number=1,
            question_text=question_text,
            supporting_page_ref=supporting_page,
            retrieved_context=document_context
        )
        session.status = SessionStatus.WAITING_FOR_ANSWER.value
        db.add(exchange)
        db.commit()
        db.refresh(exchange)
        return exchange

    async def submit_answer(
        self,
        db: Session,
        session_id: str,
        candidate_answer: str
    ) -> Dict[str, Any]:
        """Processes candidate answer, evaluates it, and generates next question or concludes session."""
        session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
        if not session:
            raise InterviewEngineError(f"Session {session_id} not found.")

        # Get latest unanswered exchange
        current_exchange = db.query(InterviewExchange).filter(
            InterviewExchange.session_id == session_id,
            InterviewExchange.candidate_answer.is_(None)
        ).order_by(InterviewExchange.question_number.desc()).first()

        if not current_exchange:
            raise InterviewEngineError("No pending question awaiting answer for this session.")

        session.status = SessionStatus.PROCESSING_ANSWER.value
        db.commit()

        # Record answer
        current_exchange.candidate_answer = candidate_answer.strip()
        current_exchange.answer_timestamp = datetime.utcnow()

        # Load previous exchanges for context
        all_exchanges = db.query(InterviewExchange).filter(
            InterviewExchange.session_id == session_id,
            InterviewExchange.candidate_answer.isnot(None)
        ).order_by(InterviewExchange.question_number).all()

        exchanges_data = [
            {
                "question_number": e.question_number,
                "question_text": e.question_text,
                "candidate_answer": e.candidate_answer,
                "answer_score": e.answer_score,
                "answer_feedback": e.answer_feedback
            }
            for e in all_exchanges
        ]

        document_context = None
        page_ref = None

        if session.document_id:
            chunks_data = self._get_document_chunks_dict(db, session.document_id)
            query = f"{session.topic} {candidate_answer}"
            relevant_chunks = retrieve_relevant_chunks(query, chunks_data, top_k=3)
            document_context, page_ref = format_retrieved_context_for_prompt(relevant_chunks)

        # AI Evaluation and follow-up generation
        ai_result = await self.ai.evaluate_answer_and_followup(
            topic=session.topic,
            difficulty=session.difficulty,
            question_text=current_exchange.question_text,
            candidate_answer=candidate_answer,
            previous_exchanges=exchanges_data,
            document_context=document_context,
            page_ref=page_ref
        )

        try:
            raw_score = float(ai_result.get("answer_score", 80.0))
            score = round(max(0.0, min(100.0, raw_score)), 1)
        except (ValueError, TypeError):
            score = 80.0
        feedback = ai_result.get("feedback", "Answer recorded.")
        next_q_text = ai_result.get("next_question")
        next_page_ref = ai_result.get("page_ref", page_ref)

        current_exchange.answer_score = score
        current_exchange.answer_feedback = feedback

        # Determine target question count based on duration
        max_questions = 3 if session.duration_minutes <= 5 else 5 if session.duration_minutes <= 15 else 8
        is_last_question = current_exchange.question_number >= max_questions

        if is_last_question or not next_q_text:
            # Conclude session and generate final evaluation
            evaluation = await self.conclude_session(db, session_id)
            return {
                "session_id": session_id,
                "status": SessionStatus.COMPLETED.value,
                "question_number": current_exchange.question_number,
                "previous_answer_score": score,
                "previous_answer_feedback": feedback,
                "is_completed": True,
                "evaluation_id": evaluation.id
            }

        # Create next question exchange
        next_exchange = InterviewExchange(
            session_id=session_id,
            question_number=current_exchange.question_number + 1,
            question_text=next_q_text,
            supporting_page_ref=next_page_ref,
            retrieved_context=document_context
        )
        session.status = SessionStatus.WAITING_FOR_ANSWER.value
        db.add(next_exchange)
        db.commit()
        db.refresh(next_exchange)

        return {
            "session_id": session_id,
            "status": SessionStatus.WAITING_FOR_ANSWER.value,
            "question_number": next_exchange.question_number,
            "question_text": next_exchange.question_text,
            "supporting_page_ref": next_exchange.supporting_page_ref,
            "previous_answer_score": score,
            "previous_answer_feedback": feedback,
            "is_completed": False
        }

    async def conclude_session(self, db: Session, session_id: str) -> InterviewEvaluation:
        """Concludes the interview, compiles transcripts, and generates full evaluation."""
        session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
        if not session:
            raise InterviewEngineError(f"Session {session_id} not found.")

        # Check if already evaluated
        existing_eval = db.query(InterviewEvaluation).filter(InterviewEvaluation.session_id == session_id).first()
        if existing_eval:
            return existing_eval

        session.ended_at = datetime.utcnow()
        session.status = SessionStatus.COMPLETED.value

        exchanges = db.query(InterviewExchange).filter(
            InterviewExchange.session_id == session_id
        ).order_by(InterviewExchange.question_number).all()

        exchanges_data = [
            {
                "question_number": e.question_number,
                "question_text": e.question_text,
                "candidate_answer": e.candidate_answer or "[No answer provided]",
                "answer_score": e.answer_score or 75.0,
                "answer_feedback": e.answer_feedback or ""
            }
            for e in exchanges
        ]

        has_document = session.document_id is not None

        # Call AI for rubric evaluation
        eval_data = await self.ai.generate_final_evaluation(
            topic=session.topic,
            category=session.category,
            difficulty=session.difficulty,
            duration_minutes=session.duration_minutes,
            exchanges=exchanges_data,
            has_document=has_document
        )

        def _clamp_int(val: Any, default: int = 80) -> int:
            try:
                return max(0, min(100, int(val)))
            except (ValueError, TypeError):
                return default

        overall = _clamp_int(eval_data.get("overall_score"), 85)
        grade = str(eval_data.get("grade", "A"))
        subj_k = _clamp_int(eval_data.get("subject_knowledge"), 85)
        tech_v = _clamp_int(eval_data.get("technical_vocabulary"), 82)
        comm = _clamp_int(eval_data.get("communication"), 80)
        code_app = _clamp_int(eval_data.get("code_application"), 80)
        syll_gr = _clamp_int(eval_data.get("syllabus_grounding"), 90)

        strengths = eval_data.get("strengths", [
            f"Strong foundational grasp of {session.topic}",
            "Structured response delivery",
            "Consistent terminology recall"
        ])
        improvements = eval_data.get("improvement_areas", [
            "Deepen practical edge-case tracing",
            "Articulate architectural trade-offs with more precision"
        ])
        examiner_feedback = eval_data.get("examiner_feedback", (
            f"The candidate completed the viva on {session.topic}. "
            "Conceptual fundamentals were sound and answers were delivered with clarity."
        ))

        evaluation = InterviewEvaluation(
            session_id=session.id,
            overall_score=overall,
            grade=grade,
            subject_knowledge=subj_k,
            technical_vocabulary=tech_v,
            communication=comm,
            code_application=code_app,
            syllabus_grounding=syll_gr,
            strengths_json=json.dumps(strengths),
            improvement_areas_json=json.dumps(improvements),
            examiner_feedback=examiner_feedback,
            created_at=datetime.utcnow()
        )

        db.add(evaluation)
        db.commit()
        db.refresh(evaluation)
        return evaluation

    def cancel_session(self, db: Session, session_id: str) -> InterviewSession:
        """Marks interview session as CANCELLED."""
        session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
        if not session:
            raise InterviewEngineError(f"Session {session_id} not found.")

        session.status = SessionStatus.CANCELLED.value
        session.ended_at = datetime.utcnow()
        db.commit()
        db.refresh(session)
        return session

interview_engine = InterviewEngine()
