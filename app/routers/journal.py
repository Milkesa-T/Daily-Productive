from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Journal, User
from app.routers.auth import get_current_user
from app.schemas.schema import (
    JournalCreate,
    JournalUpdate,
    JournalResponse,
    JournalSummaryResponse,
    JournalSearchResponse,
    JournalAskRequest,
    JournalAskResponse,
)
from app.services.ingest import (
    create_journal_with_embeddings,
    update_journal_with_embeddings,
    delete_journal_with_embeddings,
)
from app.services.search import search_journal_entries
from app.services.rag import generate_rag_answer
from app.core.exceptions import EntityNotFoundException

router = APIRouter(prefix="/journal", tags=["Journal"])


# --- Specific Routes (Must come BEFORE parameterized /{journal_id}) ---

@router.get("/search", response_model=JournalSearchResponse)
def search_journal(
    q: str = Query(..., min_length=1, description="Natural language search query"),
    limit: int = Query(3, ge=1, le=20, description="Maximum number of chunks to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Search journal entries semantically using pgvector cosine distance scoped to current user.
    """
    if not q.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search query cannot be empty or blank whitespace."
        )

    results = search_journal_entries(db=db, query=q, user_id=current_user.id, limit=limit)
    return JournalSearchResponse(
        query=q,
        total_results=len(results),
        results=results,
    )


@router.post("/ask", response_model=JournalAskResponse)
def ask_journal(
    payload: JournalAskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    RAG endpoint: answers user questions grounded in their personal journal entries.
    """
    if not payload.question.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question cannot be empty."
        )

    result = generate_rag_answer(db=db, question=payload.question, user_id=current_user.id)
    return result


# --- General CRUD Endpoints ---

@router.get("", response_model=List[JournalSummaryResponse])
def get_all_journal_entries(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all journal entries for the current user, ordered newest first."""
    journals = (
        db.query(Journal)
        .filter(Journal.user_id == current_user.id)
        .order_by(Journal.created_at.desc())
        .all()
    )
    results = []
    for j in journals:
        snippet = (j.content[:150] + "...") if len(j.content) > 150 else j.content
        results.append(
            JournalSummaryResponse(
                id=j.id,
                title=j.title,
                snippet=snippet,
                created_at=j.created_at,
                updated_at=j.updated_at,
                chunks_count=len(j.chunks) if j.chunks else 0,
            )
        )
    return results


@router.post("", response_model=JournalResponse, status_code=status.HTTP_201_CREATED)
def create_journal_entry(
    payload: JournalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new journal entry: saves parent entry, chunks text, generates
    Gemini embeddings, and persists to pgvector.
    """
    if not payload.content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Journal content cannot be empty."
        )

    journal = create_journal_with_embeddings(
        db=db,
        user_id=current_user.id,
        content=payload.content,
        title=payload.title,
    )
    return journal


@router.get("/{journal_id}", response_model=JournalResponse)
def get_journal_entry_by_id(
    journal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve a single journal entry by ID."""
    journal = (
        db.query(Journal)
        .filter(Journal.id == journal_id, Journal.user_id == current_user.id)
        .first()
    )
    if not journal:
        raise EntityNotFoundException(entity_name="Journal", entity_id=journal_id)
    return journal


@router.patch("/{journal_id}", response_model=JournalResponse)
def update_journal_entry(
    journal_id: int,
    payload: JournalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update a journal entry: if content is updated, old vector embeddings
    are cleared and new embeddings are generated and persisted.
    """
    journal = (
        db.query(Journal)
        .filter(Journal.id == journal_id, Journal.user_id == current_user.id)
        .first()
    )
    if not journal:
        raise EntityNotFoundException(entity_name="Journal", entity_id=journal_id)

    updated = update_journal_with_embeddings(
        db=db,
        journal=journal,
        content=payload.content,
        title=payload.title,
    )
    return updated


@router.delete("/{journal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_journal_entry(
    journal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a journal entry and purge all its chunk embeddings from pgvector.
    """
    journal = (
        db.query(Journal)
        .filter(Journal.id == journal_id, Journal.user_id == current_user.id)
        .first()
    )
    if not journal:
        raise EntityNotFoundException(entity_name="Journal", entity_id=journal_id)

    delete_journal_with_embeddings(db=db, journal=journal)
    return None
