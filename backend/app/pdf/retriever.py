import re
from typing import List, Dict, Any, Tuple

def tokenize(text: str) -> List[str]:
    """Simple alphanumeric tokenizer in lowercase."""
    return [t.lower() for t in re.findall(r'\b[a-zA-Z0-9_]{3,}\b', text)]

def retrieve_relevant_chunks(
    query: str,
    chunks: List[Dict[str, Any]],
    top_k: int = 3
) -> List[Dict[str, Any]]:
    """
    Ranks document chunks by lexical overlap and term frequency against query.
    Returns the top_k most relevant chunks.
    
    Each chunk dict has keys: page_number, chunk_text, (optionally id/chunk_index).
    """
    if not chunks:
        return []

    query_tokens = set(tokenize(query))
    if not query_tokens:
        # Return first top_k chunks if query has no tokens
        return chunks[:top_k]

    scored_chunks: List[Tuple[float, Dict[str, Any]]] = []

    for chunk in chunks:
        chunk_text = chunk.get("chunk_text", "")
        chunk_tokens = tokenize(chunk_text)
        
        if not chunk_tokens:
            continue

        # Score calculation: Term overlap with frequency weighting
        matches = [t for t in chunk_tokens if t in query_tokens]
        if matches:
            # Overlap density
            score = len(matches) / (len(chunk_tokens) ** 0.5)
            # Bonus for exact query phrase if present
            if query.lower() in chunk_text.lower():
                score += 5.0
            scored_chunks.append((score, chunk))
        else:
            # Baseline low score to maintain availability
            scored_chunks.append((0.01, chunk))

    # Sort descending by score
    scored_chunks.sort(key=lambda x: x[0], reverse=True)

    # Return top_k unique chunks
    selected = [item[1] for item in scored_chunks[:top_k]]
    return selected

def format_retrieved_context_for_prompt(chunks: List[Dict[str, Any]]) -> Tuple[str, str]:
    """
    Formats chunks into a context block with explicit page citations.
    Returns: (formatted_context_string, primary_page_citation)
    """
    if not chunks:
        return "No document text available.", "N/A"

    pages = sorted(list(set(c["page_number"] for c in chunks)))
    if len(pages) == 1:
        citation = f"Page {pages[0]}"
    else:
        citation = f"Pages {', '.join(str(p) for p in pages)}"

    context_lines = []
    for c in chunks:
        context_lines.append(f"--- [SOURCE: Page {c['page_number']}] ---\n{c['chunk_text']}\n")

    return "\n".join(context_lines), citation
