from datetime import datetime
from pydantic import BaseModel, ConfigDict
from typing import List, Optional

class EvaluationResponse(BaseModel):
    session_id: str
    overall_score: int
    grade: str
    subject_knowledge: int
    technical_vocabulary: int
    communication: int
    code_application: int
    syllabus_grounding: int
    strengths: List[str]
    improvement_areas: List[str]
    examiner_feedback: str
    topic: str
    category: str
    duration_minutes: int
    document_name: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
