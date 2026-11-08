from fastapi import APIRouter, Response, status
from app.ai.ollama_client import ollama_ai_provider

router = APIRouter(tags=["Health"])

@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "VYRA Backend",
        "version": "1.0.0"
    }

@router.get("/ai/health")
async def ai_health_check(response: Response):
    ai_status = await ollama_ai_provider.check_health()
    if not ai_status.get("available") or not ai_status.get("model_found"):
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return ai_status
