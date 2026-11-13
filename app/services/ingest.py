from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.models import JournalEntry
from app.services.embedding import chunk_text, get_embedding


def ingest_journal_entry(
    db: Session,
    content: str,
    title: Optional[str] = None,
    chunk_size: int = 300,
    chunk_overlap: int = 50,
) -> List[JournalEntry]:
    """
    Ingests a journal entry:
    1. Splits the text into chunks of ~chunk_size with overlap.
    2. Generates a 768-dimensional dense vector embedding for each chunk.
    3. Persists chunks and their vector embeddings into the database.
    """
    chunks = chunk_text(content, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    if not chunks:
        return []

    entries: List[JournalEntry] = []
    for index, chunk in enumerate(chunks):
        embedding_vector = get_embedding(chunk, dimensions=768)
        entry = JournalEntry(
            title=title,
            content=chunk,
            chunk_index=index,
            embedding=embedding_vector,
        )
        db.add(entry)
        entries.append(entry)

    db.commit()
    for entry in entries:
        db.refresh(entry)

    return entries

