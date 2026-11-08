import uuid
import shutil
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.session import get_db
from app.models.document import Document, DocumentChunk
from app.schemas.document import DocumentResponse, DocumentDetailResponse
from app.pdf.extractor import extract_pdf_pages_and_chunks, PDFExtractionError, OCRError

router = APIRouter(prefix="/documents", tags=["Documents"])

@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # 1. Validate file extension
    filename = file.filename or "uploaded_study_material.pdf"
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Only PDF documents (.pdf) are supported."
        )

    # 2. Generate secure file storage path
    doc_id = str(uuid.uuid4())
    safe_filename = f"{doc_id}_{Path(filename).name}"
    save_path = settings.UPLOAD_DIR / safe_filename

    # 3. Stream content and check size limit
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    total_bytes = 0

    try:
        with open(save_path, "wb") as buffer:
            while chunk := await file.read(1024 * 64):  # 64KB chunks
                total_bytes += len(chunk)
                if total_bytes > max_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB}MB."
                    )
                buffer.write(chunk)
    except HTTPException:
        if save_path.exists():
            save_path.unlink()
        raise
    except Exception as e:
        if save_path.exists():
            save_path.unlink()
        raise HTTPException(status_code=500, detail=f"Failed to write file to disk: {str(e)}")

    # 4. Extract text and split into chunks via PyMuPDF
    try:
        page_count, chunks_data = extract_pdf_pages_and_chunks(save_path)
    except OCRError as e:
        if save_path.exists():
            save_path.unlink()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except PDFExtractionError as e:
        if save_path.exists():
            save_path.unlink()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to extract text from PDF: {str(e)}"
        )
    except Exception as e:
        if save_path.exists():
            save_path.unlink()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error parsing PDF: {str(e)}"
        )

    # 5. Persist Document & DocumentChunk records
    doc_record = Document(
        id=doc_id,
        original_filename=filename,
        stored_path=str(save_path),
        file_size_bytes=total_bytes,
        page_count=page_count,
        total_chunks=len(chunks_data)
    )
    db.add(doc_record)

    for c in chunks_data:
        chunk_obj = DocumentChunk(
            document_id=doc_id,
            page_number=c["page_number"],
            chunk_index=c["chunk_index"],
            chunk_text=c["chunk_text"],
            char_count=c["char_count"]
        )
        db.add(chunk_obj)

    db.commit()
    db.refresh(doc_record)
    return doc_record

@router.get("/{document_id}", response_model=DocumentDetailResponse)
def get_document(document_id: str, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    return doc
