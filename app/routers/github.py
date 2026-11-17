from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Repository, Commit, User
from app.routers.auth import get_current_user
from app.schemas.schema import (
    RepositoryCreate,
    RepositoryResponse,
    CommitCreate,
    CommitBatchCreate,
    CommitResponse,
)
from app.core.exceptions import EntityNotFoundException

router = APIRouter(prefix="/github", tags=["GitHub"])


@router.post("/repos", response_model=RepositoryResponse, status_code=status.HTTP_201_CREATED)
def create_or_update_repo(
    repo_in: RepositoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Register or sync a GitHub repository for the current user."""
    repo = (
        db.query(Repository)
        .filter(Repository.user_id == current_user.id, Repository.full_name == repo_in.full_name)
        .first()
    )
    if repo:
        repo.name = repo_in.name
        repo.url = repo_in.url
        repo.description = repo_in.description
        repo.is_active = repo_in.is_active
    else:
        repo = Repository(
            user_id=current_user.id,
            name=repo_in.name,
            full_name=repo_in.full_name,
            url=repo_in.url,
            description=repo_in.description,
            is_active=repo_in.is_active,
        )
        db.add(repo)

    db.commit()
    db.refresh(repo)
    return RepositoryResponse(
        id=repo.id,
        name=repo.name,
        full_name=repo.full_name,
        url=repo.url,
        description=repo.description,
        is_active=repo.is_active,
        created_at=repo.created_at,
        updated_at=repo.updated_at,
        commits_count=len(repo.commits) if repo.commits else 0,
    )


@router.get("/repos", response_model=List[RepositoryResponse])
def get_user_repos(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all tracked repositories for the current user."""
    repos = db.query(Repository).filter(Repository.user_id == current_user.id).order_by(Repository.name.asc()).all()
    return [
        RepositoryResponse(
            id=r.id,
            name=r.name,
            full_name=r.full_name,
            url=r.url,
            description=r.description,
            is_active=r.is_active,
            created_at=r.created_at,
            updated_at=r.updated_at,
            commits_count=len(r.commits) if r.commits else 0,
        )
        for r in repos
    ]


@router.post("/commits", response_model=List[CommitResponse], status_code=status.HTTP_201_CREATED)
def ingest_commits(
    payload: CommitBatchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Ingest a batch of GitHub commits for a repository.
    Upserts commits idempotently based on (repository_id, commit_hash).
    """
    repo = (
        db.query(Repository)
        .filter(Repository.user_id == current_user.id, Repository.full_name == payload.repository_full_name)
        .first()
    )
    if not repo:
        # Auto-create the repo if not already tracked
        repo_name = payload.repository_full_name.split("/")[-1]
        repo = Repository(
            user_id=current_user.id,
            name=repo_name,
            full_name=payload.repository_full_name,
        )
        db.add(repo)
        db.commit()
        db.refresh(repo)

    persisted_commits = []
    for c_in in payload.commits:
        existing = (
            db.query(Commit)
            .filter(Commit.repository_id == repo.id, Commit.commit_hash == c_in.commit_hash)
            .first()
        )
        if not existing:
            new_commit = Commit(
                repository_id=repo.id,
                user_id=current_user.id,
                commit_hash=c_in.commit_hash,
                message=c_in.message,
                author_name=c_in.author_name,
                committed_at=c_in.committed_at,
                url=c_in.url,
            )
            db.add(new_commit)
            persisted_commits.append(new_commit)

    db.commit()
    for c in persisted_commits:
        db.refresh(c)

    # Return all incoming commits as response
    all_repo_commits = (
        db.query(Commit)
        .filter(Commit.repository_id == repo.id)
        .order_by(Commit.committed_at.desc())
        .limit(len(payload.commits))
        .all()
    )
    return all_repo_commits


@router.get("/commits", response_model=List[CommitResponse])
def get_user_commits(
    repo_id: Optional[int] = Query(None, description="Filter by repository ID"),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List recent synced GitHub commits for the current user."""
    query = db.query(Commit).filter(Commit.user_id == current_user.id)
    if repo_id:
        query = query.filter(Commit.repository_id == repo_id)
    return query.order_by(Commit.committed_at.desc()).limit(limit).all()
