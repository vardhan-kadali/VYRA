import asyncio
import io
import logging
from typing import Optional
import edge_tts
from app.core.config import settings

logger = logging.getLogger(__name__)

class TTSError(Exception):
    """Raised when text-to-speech synthesis fails."""
    pass

class TTSService:
    def __init__(self, default_voice: str = "en-IN-PrabhatNeural"):
        self.default_voice = default_voice

    async def synthesize(self, text: str, voice: Optional[str] = None) -> bytes:
        """
        Synthesizes text into MP3 audio bytes using EdgeTTS.
        Voice defaults to en-IN-PrabhatNeural.
        """
        clean_text = text.strip()
        if not clean_text:
            raise TTSError("Cannot synthesize empty text.")

        selected_voice = voice or self.default_voice
        try:
            communicate = edge_tts.Communicate(clean_text, selected_voice)
            buffer = io.BytesIO()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    buffer.write(chunk["data"])

            audio_data = buffer.getvalue()
            if not audio_data:
                raise TTSError("TTS synthesis produced zero audio bytes.")
            return audio_data

        except edge_tts.exceptions.EdgeTTSException as e:
            logger.error(f"EdgeTTS exception during speech synthesis: {e}")
            raise TTSError(f"EdgeTTS synthesis failed: {e}")
        except Exception as e:
            logger.error(f"Unexpected error during TTS synthesis: {e}")
            raise TTSError(f"Speech synthesis error: {e}")

# Global service instance
tts_service = TTSService(default_voice=settings.INTERVIEWER_VOICE_ID)
