from pydantic import BaseModel, ConfigDict
from typing import Optional

class UserProfileBase(BaseModel):
    full_name: str = "Candidate User"
    email: str = "candidate@example.edu"
    department: Optional[str] = "Computer Science & Engineering"
    target_goal: Optional[str] = "Academic Vivas & Technical Screening"
    default_category: str = "viva"
    default_difficulty: str = "intermediate"
    default_duration: int = 15
    strict_pdf_grounding: bool = True
    theme_mode: str = "default"
    font_scale: str = "standard"

class UserProfileCreate(UserProfileBase):
    pass

class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    department: Optional[str] = None
    target_goal: Optional[str] = None
    default_category: Optional[str] = None
    default_difficulty: Optional[str] = None
    default_duration: Optional[int] = None
    strict_pdf_grounding: Optional[bool] = None
    theme_mode: Optional[str] = None
    font_scale: Optional[str] = None

class UserProfileResponse(UserProfileBase):
    id: int
    model_config = ConfigDict(from_attributes=True)
