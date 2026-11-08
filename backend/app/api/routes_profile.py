from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.profile import UserProfile
from app.schemas.profile import UserProfileResponse, UserProfileUpdate

router = APIRouter(prefix="/profile", tags=["Profile"])

def get_or_create_default_profile(db: Session) -> UserProfile:
    profile = db.query(UserProfile).first()
    if not profile:
        profile = UserProfile(
            full_name="Candidate User",
            email="candidate@example.edu",
            department="Computer Science & Engineering",
            target_goal="Academic Vivas & Technical Screening",
            default_category="viva",
            default_difficulty="intermediate",
            default_duration=15,
            strict_pdf_grounding=True,
            theme_mode="default",
            font_scale="standard"
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile

@router.get("", response_model=UserProfileResponse)
def get_profile(db: Session = Depends(get_db)):
    return get_or_create_default_profile(db)

@router.put("", response_model=UserProfileResponse)
def update_profile(profile_in: UserProfileUpdate, db: Session = Depends(get_db)):
    profile = get_or_create_default_profile(db)
    
    update_data = profile_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        if val is not None:
            setattr(profile, field, val)
            
    db.commit()
    db.refresh(profile)
    return profile
