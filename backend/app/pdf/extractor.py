import re
from pathlib import Path
from typing import List, Dict, Any, Tuple
import pymupdf  # PyMuPDF

class PDFExtractionError(Exception):
    pass

class OCRError(PDFExtractionError):
    pass

def extract_pdf_pages_and_chunks(
    pdf_path: Path,
    chunk_size: int = 700,
    chunk_overlap: int = 100
) -> Tuple[int, List[Dict[str, Any]]]:
    """
    Extracts text from a PDF file page by page, preserving page numbers.
    Splits text into chunks with page metadata.
    
    Returns:
        (total_pages, list_of_chunks)
        where each chunk is: {
            "page_number": int, # 1-indexed
            "chunk_index": int,
            "chunk_text": str,
            "char_count": int
        }
    """
    if not pdf_path.exists():
        raise PDFExtractionError(f"File not found: {pdf_path}")
        
    try:
        doc = pymupdf.open(pdf_path)
    except Exception as e:
        raise PDFExtractionError(f"Could not open PDF file. It may be corrupt or encrypted: {str(e)}")
        
    total_pages = len(doc)
    if total_pages == 0:
        raise PDFExtractionError("The uploaded PDF has 0 pages.")

    total_extracted_text = ""
    page_texts: List[Tuple[int, str]] = []

    for page_idx in range(total_pages):
        page = doc[page_idx]
        text = page.get_text("text").strip()
        # Clean extra whitespace
        cleaned_text = re.sub(r'\s+', ' ', text).strip()
        page_texts.append((page_idx + 1, cleaned_text))
        total_extracted_text += cleaned_text

    doc.close()

    # If the document has pages but no extractable text, it is likely a scanned PDF
    if len(total_extracted_text.strip()) < 20:
        raise OCRError(
            "This PDF appears to be a scanned document or image without embedded text. "
            "Optical Character Recognition (OCR) is required to process scanned files. "
            "Please upload a text-based syllabus or searchable PDF."
        )

    # Chunking pipeline preserving page boundaries
    all_chunks: List[Dict[str, Any]] = []
    chunk_counter = 0

    for page_num, text in page_texts:
        if not text:
            continue
            
        # If page text fits in one chunk
        if len(text) <= chunk_size:
            chunk_counter += 1
            all_chunks.append({
                "page_number": page_num,
                "chunk_index": chunk_counter,
                "chunk_text": text,
                "char_count": len(text)
            })
            continue

        # Split long page text with overlap
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunk_content = text[start:end].strip()
            
            if chunk_content:
                chunk_counter += 1
                all_chunks.append({
                    "page_number": page_num,
                    "chunk_index": chunk_counter,
                    "chunk_text": chunk_content,
                    "char_count": len(chunk_content)
                })
                
            start += (chunk_size - chunk_overlap)

    return total_pages, all_chunks
