from datetime import datetime
from pydantic import BaseModel, ConfigDict
from typing import List, Optional

class DocumentChunkResponse(BaseModel):
    id: int
    page_number: int
    chunk_index: int
    chunk_text: str
    char_count: int
    model_config = ConfigDict(from_attributes=True)

class DocumentResponse(BaseModel):
    id: str
    original_filename: str
    file_size_bytes: int
    page_count: int
    total_chunks: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class DocumentDetailResponse(DocumentResponse):
    chunks: List[DocumentChunkResponse] = []
