import json
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.session import get_db
from app.models.interview import InterviewSession, InterviewEvaluation, SessionStatus
from app.models.document import Document
from app.schemas.evaluation import EvaluationResponse

router = APIRouter(tags=["Reports & Dashboard"])

@router.get("/interviews/{session_id}/report", response_model=EvaluationResponse)
def get_interview_report(session_id: str, db: Session = Depends(get_db)):
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found.")

    eval_obj = db.query(InterviewEvaluation).filter(InterviewEvaluation.session_id == session_id).first()
    if not eval_obj:
        raise HTTPException(status_code=404, detail="Evaluation report not yet generated for this session.")

    doc_name = None
    if session.document_id:
        doc = db.query(Document).filter(Document.id == session.document_id).first()
        if doc:
            doc_name = doc.original_filename

    try:
        strengths = json.loads(eval_obj.strengths_json)
    except Exception:
        strengths = []

    try:
        improvements = json.loads(eval_obj.improvement_areas_json)
    except Exception:
        improvements = []

    return {
        "session_id": session.id,
        "overall_score": eval_obj.overall_score,
        "grade": eval_obj.grade,
        "subject_knowledge": eval_obj.subject_knowledge,
        "technical_vocabulary": eval_obj.technical_vocabulary,
        "communication": eval_obj.communication,
        "code_application": eval_obj.code_application,
        "syllabus_grounding": eval_obj.syllabus_grounding,
        "strengths": strengths,
        "improvement_areas": improvements,
        "examiner_feedback": eval_obj.examiner_feedback,
        "topic": session.topic,
        "category": session.category,
        "duration_minutes": session.duration_minutes,
        "document_name": doc_name,
        "created_at": eval_obj.created_at
    }

@router.get("/reports", response_model=List[EvaluationResponse])
def list_reports(db: Session = Depends(get_db)):
    evals = db.query(InterviewEvaluation).order_by(InterviewEvaluation.created_at.desc()).all()
    results = []

    for ev in evals:
        s = ev.session
        doc_name = None
        if s and s.document_id:
            doc = db.query(Document).filter(Document.id == s.document_id).first()
            if doc:
                doc_name = doc.original_filename

        try:
            strengths = json.loads(ev.strengths_json)
        except Exception:
            strengths = []

        try:
            improvements = json.loads(ev.improvement_areas_json)
        except Exception:
            improvements = []

        results.append({
            "session_id": s.id if s else "",
            "overall_score": ev.overall_score,
            "grade": ev.grade,
            "subject_knowledge": ev.subject_knowledge,
            "technical_vocabulary": ev.technical_vocabulary,
            "communication": ev.communication,
            "code_application": ev.code_application,
            "syllabus_grounding": ev.syllabus_grounding,
            "strengths": strengths,
            "improvement_areas": improvements,
            "examiner_feedback": ev.examiner_feedback,
            "topic": s.topic if s else "Viva Session",
            "category": s.category if s else "viva",
            "duration_minutes": s.duration_minutes if s else 15,
            "document_name": doc_name,
            "created_at": ev.created_at
        })

    return results

@router.get("/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    """Computes real metrics from persistent SQLite storage for the Dashboard."""
    # Completed sessions
    completed_sessions = db.query(InterviewSession).filter(
        InterviewSession.status == SessionStatus.COMPLETED.value
    ).all()
    completed_count = len(completed_sessions)

    # Practice duration
    total_minutes = sum(s.duration_minutes for s in completed_sessions)
    hours = round(total_minutes / 60.0, 1)

    # Average score
    avg_score_res = db.query(func.avg(InterviewEvaluation.overall_score)).scalar()
    avg_score = round(float(avg_score_res), 1) if avg_score_res is not None else None

    # PDF grounded tests
    pdf_tests_count = db.query(InterviewSession).filter(
        InterviewSession.status == SessionStatus.COMPLETED.value,
        InterviewSession.document_id.isnot(None)
    ).count()

    # Competency averages
    if completed_count > 0:
        avg_subj = round(float(db.query(func.avg(InterviewEvaluation.subject_knowledge)).scalar() or 85), 0)
        avg_tech = round(float(db.query(func.avg(InterviewEvaluation.technical_vocabulary)).scalar() or 80), 0)
        avg_comm = round(float(db.query(func.avg(InterviewEvaluation.communication)).scalar() or 80), 0)
        avg_syll = round(float(db.query(func.avg(InterviewEvaluation.syllabus_grounding)).scalar() or 90), 0)
    else:
        avg_subj, avg_tech, avg_comm, avg_syll = None, None, None, None

    # Recent activity
    recent_sessions = db.query(InterviewSession).order_by(
        InterviewSession.created_at.desc()
    ).limit(5).all()

    activity_items = []
    for s in recent_sessions:
        doc_name = None
        if s.document_id:
            doc = db.query(Document).filter(Document.id == s.document_id).first()
            if doc:
                doc_name = doc.original_filename

        score = None
        if s.evaluation:
            score = s.evaluation.overall_score

        activity_items.append({
            "id": s.id,
            "topic": s.topic,
            "category": s.category,
            "subject": s.subject,
            "difficulty": s.difficulty,
            "duration_minutes": s.duration_minutes,
            "document_name": doc_name,
            "status": s.status,
            "created_at": s.created_at.isoformat(),
            "score": score
        })

    return {
        "completed_count": completed_count,
        "practice_hours": hours,
        "average_score": avg_score,
        "pdf_tests_count": pdf_tests_count,
        "competency_averages": {
            "subject_knowledge": avg_subj,
            "technical_vocabulary": avg_tech,
            "communication": avg_comm,
            "syllabus_grounding": avg_syll,
        },
        "recent_activity": activity_items
    }
