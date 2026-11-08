import httpx
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Response, status, HTTPException
import logging
logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/avatar", tags=["Avatar & Lip Sync"])

LIVETALKING_BASE_URL = "http://127.0.0.1:8010"

class AvatarOfferRequest(BaseModel):
    sdp: str
    type: str
    avatar: Optional[str] = "wav2lip_avatar_glass_man"

class AvatarSpeakRequest(BaseModel):
    sessionid: str
    text: str
    interrupt: Optional[bool] = True

class AvatarInterruptRequest(BaseModel):
    sessionid: str

@router.get("/status")
async def get_avatar_status(response: Response):
    """
    Checks if the local LiveTalking avatar service (Dr. Prabhat Sharma) is running.
    """
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            res = await client.get(f"{LIVETALKING_BASE_URL}/")
            # LiveTalking returns 302 or 200 on root
            is_alive = res.status_code in (200, 302)
    except Exception as e:
        is_alive = False

    if is_alive:
        return {
            "available": True,
            "status": "ready",
            "avatar_id": "wav2lip_avatar_glass_man",
            "persona": "Dr. Prabhat Sharma",
            "voice": "en-IN-PrabhatNeural",
            "transport": "webrtc",
            "resolution": "720x1276",
            "licensing": "CC BY-NC 4.0 Non-commercial prototype"
        }
    else:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "available": False,
            "status": "offline",
            "avatar_id": "wav2lip_avatar_glass_man",
            "fallback": "high_res_portrait_with_edgetts",
            "detail": "LiveTalking male avatar microservice is not responding on 127.0.0.1:8010"
        }

@router.post("/offer")
async def create_avatar_webrtc_session(payload: AvatarOfferRequest):
    """
    Forwards WebRTC offer SDP to LiveTalking server to establish bidirectional media track streaming.
    """
    url = f"{LIVETALKING_BASE_URL}/offer"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(url, json={
                "sdp": payload.sdp,
                "type": payload.type,
                "avatar": payload.avatar or "wav2lip_avatar_glass_man"
            })
            if res.status_code != 200:
                raise HTTPException(
                    status_code=res.status_code,
                    detail=f"LiveTalking returned HTTP {res.status_code}: {res.text}"
                )
            return res.json()
    except httpx.ConnectError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not connect to LiveTalking microservice at 127.0.0.1:8010. Please ensure LiveTalking is running."
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Avatar WebRTC negotiation failed: {str(e)}"
        )

@router.post("/speak")
async def trigger_avatar_speech(payload: AvatarSpeakRequest):
    """
    Triggers speech synthesis and lip-sync video frame generation for Dr. Prabhat Sharma.
    """
    url = f"{LIVETALKING_BASE_URL}/human"
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.post(url, json={
                "sessionid": payload.sessionid,
                "type": "echo",
                "text": payload.text,
                "interrupt": payload.interrupt
            })
            if res.status_code != 200:
                raise HTTPException(
                    status_code=res.status_code,
                    detail=f"LiveTalking speech trigger returned HTTP {res.status_code}: {res.text}"
                )
            data = res.json()
            if data.get("code") != 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"LiveTalking error: {data.get('msg')}"
                )
            return {"status": "speaking", "detail": "Speech and lip synchronization triggered"}
    except httpx.ConnectError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LiveTalking microservice unavailable."
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Speech trigger error: {str(e)}"
        )

@router.post("/interrupt")
async def interrupt_avatar_speech(payload: AvatarInterruptRequest):
    """
    Interrupts ongoing speech and clears active talk queues.
    """
    url = f"{LIVETALKING_BASE_URL}/interrupt_talk"
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            res = await client.post(url, json={"sessionid": payload.sessionid})
            return res.json()
    except Exception as e:
        return {"code": -1, "msg": str(e)}
