from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.schema import (
    JournalCreate,
    JournalSearchResponse,
    JournalSearchResult,
)
from app.services.ingest import ingest_journal_entry
from app.services.search import search_journal_entries

router = APIRouter(prefix="/journal", tags=["Journal"])


@router.get("/search", response_model=JournalSearchResponse)
def search_journal(
    q: str = Query(..., min_length=1, description="Natural language search query"),
    limit: int = Query(3, ge=1, le=20, description="Maximum number of chunks to return"),
    db: Session = Depends(get_db),
):
    """
    Search journal entries semantically using pgvector cosine distance.
    Returns the top-k most relevant chunks ordered by similarity score.
    """
    if not q.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search query cannot be empty or blank whitespace."
        )

    results = search_journal_entries(db=db, query=q, limit=limit)
    return JournalSearchResponse(
        query=q,
        total_results=len(results),
        results=results,
    )


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_journal_entry(
    payload: JournalCreate,
    db: Session = Depends(get_db),
):
    """
    Ingest a new journal entry: splits into chunks, embeds with Gemini,
    and stores in the pgvector database.
    """
    if not payload.content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Journal content cannot be empty."
        )

    created_chunks = ingest_journal_entry(
        db=db,
        content=payload.content,
        title=payload.title,
    )
    return {
        "message": f"Successfully ingested journal entry into {len(created_chunks)} chunk(s).",
        "chunks_created": len(created_chunks),
        "title": payload.title,
    }

