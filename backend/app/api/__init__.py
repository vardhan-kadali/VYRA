from fastapi import APIRouter
from app.api.routes_health import router as health_router
from app.api.routes_profile import router as profile_router
from app.api.routes_documents import router as documents_router
from app.api.routes_interviews import router as interviews_router
from app.api.routes_reports import router as reports_router
from app.api.routes_audio import router as audio_router
from app.api.routes_avatar import router as avatar_router

api_router = APIRouter(prefix="/api")

api_router.include_router(health_router)
api_router.include_router(profile_router)
api_router.include_router(documents_router)
api_router.include_router(interviews_router)
api_router.include_router(reports_router)
api_router.include_router(audio_router)
api_router.include_router(avatar_router)

__all__ = ["api_router"]
