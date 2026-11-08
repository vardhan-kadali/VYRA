from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.database.session import Base, engine
import app.models  # Register models with metadata
from app.api import api_router
from app.interview.engine import InterviewEngineError
from app.pdf.extractor import PDFExtractionError, OCRError
from app.ai.ollama_client import OllamaUnavailableError

# Initialize database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend AI viva & technical interview engine for VYRA",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Configuration for local Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handlers
@app.exception_handler(OllamaUnavailableError)
async def ollama_unavailable_handler(request: Request, exc: OllamaUnavailableError):
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"error": "AI Service Unavailable", "detail": str(exc)}
    )

@app.exception_handler(OCRError)
async def ocr_error_handler(request: Request, exc: OCRError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": "OCR Required", "detail": str(exc)}
    )

@app.exception_handler(PDFExtractionError)
async def pdf_error_handler(request: Request, exc: PDFExtractionError):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"error": "PDF Processing Error", "detail": str(exc)}
    )

@app.exception_handler(InterviewEngineError)
async def interview_engine_handler(request: Request, exc: InterviewEngineError):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"error": "Interview Engine Error", "detail": str(exc)}
    )

# Include API Router
app.include_router(api_router)

@app.get("/")
def root():
    return {
        "app": "VYRA",
        "tagline": "Your AI. Your Interview. Your Growth.",
        "status": "Online",
        "api_docs": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
