from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.models import Journal, JournalEntry
from app.services.embedding import chunk_text, get_embedding


def ingest_journal_entry(
    db: Session,
    content: str,
    user_id: int,
    title: Optional[str] = None,
    journal_id: Optional[int] = None,
    chunk_size: int = 300,
    chunk_overlap: int = 50,
) -> List[JournalEntry]:
    """
    Ingests a journal entry:
    1. Splits the text into chunks of ~chunk_size with overlap.
    2. Generates a 768-dimensional dense vector embedding for each chunk.
    3. Persists chunks and their vector embeddings into the database tied to user_id and journal_id.
    """
    chunks = chunk_text(content, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    if not chunks:
        return []

    entries: List[JournalEntry] = []
    for index, chunk in enumerate(chunks):
        embedding_vector = get_embedding(chunk, dimensions=768)
        entry = JournalEntry(
            user_id=user_id,
            journal_id=journal_id,
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


def create_journal_with_embeddings(
    db: Session,
    user_id: int,
    content: str,
    title: Optional[str] = None,
) -> Journal:
    """Creates a parent Journal entity and chunks + embeds it."""
    journal = Journal(
        user_id=user_id,
        title=title,
        content=content,
    )
    db.add(journal)
    db.commit()
    db.refresh(journal)

    ingest_journal_entry(
        db=db,
        content=content,
        user_id=user_id,
        title=title,
        journal_id=journal.id,
    )
    db.refresh(journal)
    return journal


def update_journal_with_embeddings(
    db: Session,
    journal: Journal,
    content: Optional[str] = None,
    title: Optional[str] = None,
) -> Journal:
    """Updates a Journal entity, and if content changed, re-chunks and re-embeds."""
    re_embed = False
    if title is not None:
        journal.title = title
    if content is not None and content.strip() and content != journal.content:
        journal.content = content
        re_embed = True

    db.commit()

    if re_embed:
        # Delete old chunks
        db.query(JournalEntry).filter(JournalEntry.journal_id == journal.id).delete(synchronize_session=False)
        db.commit()

        # Re-embed new content
        ingest_journal_entry(
            db=db,
            content=journal.content,
            user_id=journal.user_id,
            title=journal.title,
            journal_id=journal.id,
        )

    db.refresh(journal)
    return journal


def delete_journal_with_embeddings(db: Session, journal: Journal) -> None:
    """Deletes a Journal entity and its associated chunks/embeddings."""
    db.delete(journal)
    db.commit()
