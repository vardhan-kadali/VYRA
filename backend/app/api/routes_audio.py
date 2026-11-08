from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import Optional

from app.services.tts_service import tts_service, TTSError
from app.core.config import settings

router = APIRouter(prefix="/audio", tags=["Audio"])

class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000, description="Text to synthesize into speech")
    voice: Optional[str] = Field(default=None, description="Optional EdgeTTS voice identifier")

@router.post("/tts", summary="Synthesize speech from text")
async def synthesize_speech_post(payload: TTSRequest):
    """
    Synthesizes speech from provided text using EdgeTTS.
    Returns audio/mpeg stream playable directly in browser.
    """
    try:
        audio_bytes = await tts_service.synthesize(payload.text, payload.voice)
        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline; filename=speech.mp3",
                "Cache-Control": "public, max-age=3600"
            }
        )
    except TTSError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Speech synthesis error: {e}"
        )

@router.get("/tts", summary="Synthesize speech from text (GET)")
async def synthesize_speech_get(
    text: str = Query(..., min_length=1, max_length=2000),
    voice: Optional[str] = Query(default=None)
):
    """
    Synthesizes speech via GET query parameter for direct HTML5 audio element binding.
    """
    try:
        audio_bytes = await tts_service.synthesize(text, voice)
        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline; filename=speech.mp3",
                "Cache-Control": "public, max-age=3600"
            }
        )
    except TTSError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Speech synthesis error: {e}"
        )

@router.get("/voices", summary="Get configured TTS voice and options")
def get_voices():
    """
    Returns default interviewer voice and metadata.
    """
    return {
        "default_voice": settings.INTERVIEWER_VOICE_ID,
        "interviewer_name": settings.INTERVIEWER_PERSONA_NAME,
        "interviewer_role": settings.INTERVIEWER_ROLE,
        "supported_voices": [
            {
                "id": "en-IN-PrabhatNeural",
                "name": "Dr. Prabhat Sharma (Indian English Male - Primary)",
                "gender": "Male",
                "locale": "en-IN"
            },
            {
                "id": "en-IN-NeerjaNeural",
                "name": "Neerja (Indian English Female)",
                "gender": "Female",
                "locale": "en-IN"
            }
        ]
    }
