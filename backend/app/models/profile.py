from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from app.database.session import Base

class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(120), nullable=False, default="Candidate User")
    email = Column(String(255), nullable=False, default="candidate@example.edu")
    department = Column(String(150), nullable=True, default="Computer Science & Engineering")
    target_goal = Column(String(255), nullable=True, default="Academic Vivas & Technical Screening")
    
    # Interview Preferences
    default_category = Column(String(50), nullable=False, default="viva")
    default_difficulty = Column(String(50), nullable=False, default="intermediate")
    default_duration = Column(Integer, nullable=False, default=15)
    strict_pdf_grounding = Column(Boolean, nullable=False, default=True)
    
    # Appearance Preferences
    theme_mode = Column(String(50), nullable=False, default="default")
    font_scale = Column(String(50), nullable=False, default="standard")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
