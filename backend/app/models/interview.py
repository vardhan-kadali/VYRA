import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, Enum
from sqlalchemy.orm import relationship
from app.database.session import Base

class SessionStatus(str, enum.Enum):
    CREATED = "CREATED"
    READY = "READY"
    IN_PROGRESS = "IN_PROGRESS"
    WAITING_FOR_ANSWER = "WAITING_FOR_ANSWER"
    PROCESSING_ANSWER = "PROCESSING_ANSWER"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    ERROR = "ERROR"

class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id = Column(String(36), primary_key=True, index=True)
    topic = Column(String(255), nullable=False)
    category = Column(String(50), nullable=False)  # viva, job, custom
    subject = Column(String(100), nullable=True)
    difficulty = Column(String(50), nullable=False)  # beginner, intermediate, advanced
    duration_minutes = Column(Integer, nullable=False, default=15)
    
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    
    status = Column(String(50), nullable=False, default=SessionStatus.CREATED.value)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)

    # Relationships
    document = relationship("Document", back_populates="interviews")
    exchanges = relationship("InterviewExchange", back_populates="session", cascade="all, delete-orphan", order_by="InterviewExchange.question_number")
    evaluation = relationship("InterviewEvaluation", back_populates="session", uselist=False, cascade="all, delete-orphan")


class InterviewExchange(Base):
    __tablename__ = "interview_exchanges"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(36), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    
    question_number = Column(Integer, nullable=False)
    question_text = Column(Text, nullable=False)
    supporting_page_ref = Column(String(100), nullable=True)
    retrieved_context = Column(Text, nullable=True)
    
    candidate_answer = Column(Text, nullable=True)
    answer_timestamp = Column(DateTime, nullable=True)
    
    answer_score = Column(Float, nullable=True)  # 0.0 to 100.0
    answer_feedback = Column(Text, nullable=True)
    
    session = relationship("InterviewSession", back_populates="exchanges")


class InterviewEvaluation(Base):
    __tablename__ = "interview_evaluations"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(36), ForeignKey("interview_sessions.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    overall_score = Column(Integer, nullable=False)  # 0 to 100
    grade = Column(String(10), nullable=False)        # A+, A, B, C, etc.
    
    # 5-Dimension Rubric Scores
    subject_knowledge = Column(Integer, nullable=False)     # 0 to 100
    technical_vocabulary = Column(Integer, nullable=False)  # 0 to 100
    communication = Column(Integer, nullable=False)         # 0 to 100
    code_application = Column(Integer, nullable=False)      # 0 to 100
    syllabus_grounding = Column(Integer, nullable=False)    # 0 to 100
    
    strengths_json = Column(Text, nullable=False)           # JSON array of strings
    improvement_areas_json = Column(Text, nullable=False)   # JSON array of strings
    examiner_feedback = Column(Text, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("InterviewSession", back_populates="evaluation")
