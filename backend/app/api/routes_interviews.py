from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.interview import InterviewSession, InterviewExchange, InterviewEvaluation, SessionStatus
from app.models.document import Document
from app.schemas.interview import (
    InterviewCreate,
    AnswerSubmit,
    InterviewSessionResponse,
    InterviewSummaryItem,
    QuestionNextResponse,
)
from app.interview.engine import interview_engine, InterviewEngineError
from app.ai.ollama_client import OllamaUnavailableError

router = APIRouter(prefix="/interviews", tags=["Interviews"])

@router.post("", response_model=InterviewSessionResponse, status_code=status.HTTP_201_CREATED)
def create_interview(
    interview_in: InterviewCreate,
    db: Session = Depends(get_db)
):
    try:
        session = interview_engine.create_session(
            db=db,
            topic=interview_in.topic,
            category=interview_in.category,
            subject=interview_in.subject,
            difficulty=interview_in.difficulty,
            duration_minutes=interview_in.duration_minutes,
            document_id=interview_in.document_id
        )
        
        doc_name = None
        if session.document_id:
            doc = db.query(Document).filter(Document.id == session.document_id).first()
            if doc:
                doc_name = doc.original_filename
                
        return {
            "id": session.id,
            "topic": session.topic,
            "category": session.category,
            "subject": session.subject,
            "difficulty": session.difficulty,
            "duration_minutes": session.duration_minutes,
            "document_id": session.document_id,
            "document_name": doc_name,
            "status": session.status,
            "created_at": session.created_at,
            "started_at": session.started_at,
            "ended_at": session.ended_at,
            "exchanges": []
        }
    except InterviewEngineError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("", response_model=List[InterviewSummaryItem])
def list_interviews(
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(InterviewSession).order_by(InterviewSession.created_at.desc())
    if category and category.lower() != "all":
        query = query.filter(InterviewSession.category == category.lower())
    
    sessions = query.all()
    results = []

    for s in sessions:
        doc_name = None
        if s.document_id:
            doc = db.query(Document).filter(Document.id == s.document_id).first()
            if doc:
                doc_name = doc.original_filename

        overall = None
        if s.evaluation:
            overall = s.evaluation.overall_score

        results.append({
            "id": s.id,
            "topic": s.topic,
            "category": s.category,
            "subject": s.subject,
            "difficulty": s.difficulty,
            "duration_minutes": s.duration_minutes,
            "document_name": doc_name,
            "status": s.status,
            "created_at": s.created_at,
            "overall_score": overall
        })
    return results

@router.get("/{session_id}", response_model=InterviewSessionResponse)
def get_interview(session_id: str, db: Session = Depends(get_db)):
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found.")

    doc_name = None
    if session.document_id:
        doc = db.query(Document).filter(Document.id == session.document_id).first()
        if doc:
            doc_name = doc.original_filename

    return {
        "id": session.id,
        "topic": session.topic,
        "category": session.category,
        "subject": session.subject,
        "difficulty": session.difficulty,
        "duration_minutes": session.duration_minutes,
        "document_id": session.document_id,
        "document_name": doc_name,
        "status": session.status,
        "created_at": session.created_at,
        "started_at": session.started_at,
        "ended_at": session.ended_at,
        "exchanges": session.exchanges
    }

@router.post("/{session_id}/start", response_model=QuestionNextResponse)
async def start_interview(session_id: str, db: Session = Depends(get_db)):
    try:
        q1_exchange = await interview_engine.start_session(db, session_id)
        return {
            "session_id": session_id,
            "status": SessionStatus.WAITING_FOR_ANSWER.value,
            "question_number": q1_exchange.question_number,
            "question_text": q1_exchange.question_text,
            "supporting_page_ref": q1_exchange.supporting_page_ref,
            "previous_answer_score": None,
            "previous_answer_feedback": None
        }
    except OllamaUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except InterviewEngineError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{session_id}/answer")
async def submit_answer(
    session_id: str,
    answer_in: AnswerSubmit,
    db: Session = Depends(get_db)
):
    if not answer_in.answer.strip():
        raise HTTPException(status_code=400, detail="Answer cannot be empty.")

    try:
        result = await interview_engine.submit_answer(
            db=db,
            session_id=session_id,
            candidate_answer=answer_in.answer.strip()
        )
        return result
    except OllamaUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except InterviewEngineError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{session_id}/end")
async def end_interview(session_id: str, db: Session = Depends(get_db)):
    try:
        eval_obj = await interview_engine.conclude_session(db, session_id)
        return {
            "session_id": session_id,
            "status": SessionStatus.COMPLETED.value,
            "evaluation_id": eval_obj.id,
            "overall_score": eval_obj.overall_score
        }
    except OllamaUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except InterviewEngineError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{session_id}/cancel")
def cancel_interview(session_id: str, db: Session = Depends(get_db)):
    try:
        session = interview_engine.cancel_session(db, session_id)
        return {"session_id": session.id, "status": session.status}
    except InterviewEngineError as e:
        raise HTTPException(status_code=400, detail=str(e))
