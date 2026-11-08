from datetime import datetime
from pydantic import BaseModel, ConfigDict
from typing import List, Optional

class InterviewCreate(BaseModel):
    topic: str
    category: str = "viva"
    subject: Optional[str] = None
    difficulty: str = "intermediate"
    duration_minutes: int = 15
    document_id: Optional[str] = None

class AnswerSubmit(BaseModel):
    answer: str

class ExchangeResponse(BaseModel):
    id: int
    question_number: int
    question_text: str
    supporting_page_ref: Optional[str] = None
    candidate_answer: Optional[str] = None
    answer_timestamp: Optional[datetime] = None
    answer_score: Optional[float] = None
    answer_feedback: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class InterviewSessionResponse(BaseModel):
    id: str
    topic: str
    category: str
    subject: Optional[str] = None
    difficulty: str
    duration_minutes: int
    document_id: Optional[str] = None
    document_name: Optional[str] = None
    status: str
    created_at: datetime
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    exchanges: List[ExchangeResponse] = []
    model_config = ConfigDict(from_attributes=True)

class InterviewSummaryItem(BaseModel):
    id: str
    topic: str
    category: str
    subject: Optional[str] = None
    difficulty: str
    duration_minutes: int
    document_name: Optional[str] = None
    status: str
    created_at: datetime
    overall_score: Optional[int] = None

class QuestionNextResponse(BaseModel):
    session_id: str
    status: str
    question_number: int
    question_text: str
    supporting_page_ref: Optional[str] = None
    previous_answer_score: Optional[float] = None
    previous_answer_feedback: Optional[str] = None
