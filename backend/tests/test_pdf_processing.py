import io
import pymupdf
import pytest
from pathlib import Path
from app.pdf.extractor import extract_pdf_pages_and_chunks, OCRError, PDFExtractionError
from app.pdf.retriever import retrieve_relevant_chunks, format_retrieved_context_for_prompt

def create_sample_pdf(tmp_path: Path) -> Path:
    """Creates a 2-page syllabus PDF for testing."""
    pdf_path = tmp_path / "sample_syllabus.pdf"
    doc = pymupdf.open()

    # Page 1: C++ VTables
    page1 = doc.new_page()
    page1.insert_text(
        (50, 72),
        "Unit 1: Object Oriented Programming and Virtual Method Tables (VTables) in C++.\n"
        "A vtable is a table of function pointers used in C++ to resolve method calls dynamically at runtime.\n"
        "Each class with virtual functions contains a virtual pointer (vptr) pointing to its class vtable."
    )

    # Page 2: Memory & RAII
    page2 = doc.new_page()
    page2.insert_text(
        (50, 72),
        "Unit 2: Resource Acquisition Is Initialization (RAII) and Smart Pointer Semantics.\n"
        "In modern C++, std::unique_ptr provides zero-overhead exclusive ownership of a dynamically allocated resource.\n"
        "When the unique_ptr goes out of scope, its destructor invokes delete automatically, preventing memory leaks."
    )

    doc.save(pdf_path)
    doc.close()
    return pdf_path

def create_blank_pdf(tmp_path: Path) -> Path:
    """Creates a blank PDF with 0 extractable text to test OCR requirement detection."""
    pdf_path = tmp_path / "blank_scanned.pdf"
    doc = pymupdf.open()
    doc.new_page()
    doc.save(pdf_path)
    doc.close()
    return pdf_path

def test_pdf_extraction_page_preservation(tmp_path):
    pdf_path = create_sample_pdf(tmp_path)
    total_pages, chunks = extract_pdf_pages_and_chunks(pdf_path)

    assert total_pages == 2
    assert len(chunks) >= 2

    pages_present = [c["page_number"] for c in chunks]
    assert 1 in pages_present
    assert 2 in pages_present

    # Check page 1 content
    p1_chunks = [c for c in chunks if c["page_number"] == 1]
    assert any("vtable" in c["chunk_text"].lower() for c in p1_chunks)

    # Check page 2 content
    p2_chunks = [c for c in chunks if c["page_number"] == 2]
    assert any("unique_ptr" in c["chunk_text"].lower() for c in p2_chunks)

def test_lexical_retriever_and_citations(tmp_path):
    pdf_path = create_sample_pdf(tmp_path)
    _, chunks = extract_pdf_pages_and_chunks(pdf_path)

    # Query for vtable -> should rank Page 1 top
    results_vtable = retrieve_relevant_chunks("vtable runtime dynamic polymorphism", chunks, top_k=1)
    assert len(results_vtable) == 1
    assert results_vtable[0]["page_number"] == 1

    # Query for unique_ptr -> should rank Page 2 top
    results_raii = retrieve_relevant_chunks("std::unique_ptr memory leak destructor", chunks, top_k=1)
    assert len(results_raii) == 1
    assert results_raii[0]["page_number"] == 2

    # Check context formatting with page citations
    formatted_ctx, page_ref = format_retrieved_context_for_prompt(results_vtable)
    assert "SOURCE: Page 1" in formatted_ctx
    assert page_ref == "Page 1"

def test_ocr_requirement_on_blank_pdf(tmp_path):
    blank_pdf = create_blank_pdf(tmp_path)
    with pytest.raises(OCRError) as exc_info:
        extract_pdf_pages_and_chunks(blank_pdf)
    assert "Optical Character Recognition (OCR) is required" in str(exc_info.value)

def test_document_upload_api(client, tmp_path):
    pdf_path = create_sample_pdf(tmp_path)
    with open(pdf_path, "rb") as f:
        response = client.post(
            "/api/documents/upload",
            files={"file": ("sample_syllabus.pdf", f, "application/pdf")}
        )

    assert response.status_code == 201
    data = response.json()
    assert data["original_filename"] == "sample_syllabus.pdf"
    assert data["page_count"] == 2
    assert data["total_chunks"] >= 2
    assert "id" in data

    # Verify GET detail endpoint
    doc_id = data["id"]
    get_res = client.get(f"/api/documents/{doc_id}")
    assert get_res.status_code == 200
    doc_detail = get_res.json()
    assert len(doc_detail["chunks"]) >= 2
    assert doc_detail["chunks"][0]["page_number"] in (1, 2)

def test_reject_non_pdf_upload(client):
    fake_txt = io.BytesIO(b"Hello world, this is a plain text file.")
    response = client.post(
        "/api/documents/upload",
        files={"file": ("test.txt", fake_txt, "text/plain")}
    )
    assert response.status_code == 400
    assert "Only PDF documents (.pdf) are supported" in response.json()["detail"]
