from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "VYRA Interview Engine"
    API_V1_STR: str = "/api"
    
    # Base directory for backend
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    
    # SQLite Database
    DATABASE_URL: str = "sqlite:///./vyra.db"
    
    # Upload storage for study materials (PDFs)
    UPLOAD_DIR: Path = BASE_DIR / "uploads"
    
    # Local Ollama AI Provider Configuration (Legacy)
    OLLAMA_BASE_URL: str = "http://127.0.0.1:11434"
    OLLAMA_MODEL: str = "gemma3:4b"
    OLLAMA_TIMEOUT_SECONDS: float = 150.0
    OLLAMA_NUM_GPU: int = 0  # Offload Gemma 3 to CPU (0 VRAM) to guarantee 100% GPU headroom for LiveTalking Wav2Lip avatar

    # Google Gemini AI Configuration (Stage 1 Migration Prepared)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    
    # Interviewer Persona Configuration
    INTERVIEWER_PERSONA_NAME: str = "Dr. Prabhat Sharma"
    INTERVIEWER_ROLE: str = "Senior Technical Examiner & Academic Viva Chair"
    INTERVIEWER_VOICE_ID: str = "en-IN-PrabhatNeural"
    
    # File limits
    MAX_UPLOAD_SIZE_MB: int = 25
    
    # Allowed CORS Origins for Next.js frontend
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://10.4.86.36:3000",
    ]

    model_config = SettingsConfigDict(
        env_file=(Path(__file__).resolve().parent.parent.parent / ".env", ".env"),
        extra="ignore"
    )

settings = Settings()

# Ensure uploads directory exists
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
