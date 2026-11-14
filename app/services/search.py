from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.models import JournalEntry
from app.services.embedding import get_embedding


def search_journal_entries(
    db: Session,
    query: str,
    limit: int = 3,
    threshold: Optional[float] = None
) -> List[Dict[str, Any]]:
    """
    Performs semantic vector search across journal entries using pgvector's
    cosine distance operator (<=>).

    - query: Natural language search string.
    - limit: Maximum number of chunks to return (top-k).
    - threshold: Optional minimum cosine similarity (0.0 to 1.0).
    """
    clean_query = query.strip()
    if not clean_query:
        return []

    # 1. Embed user query using the same model and dimensionality (768)
    query_vector = get_embedding(clean_query, dimensions=768)

    # 2. Perform cosine distance search in PostgreSQL via pgvector
    # Cosine distance = 1.0 - cosine_similarity (0.0 = identical, 2.0 = opposite)
    distance_col = JournalEntry.embedding.cosine_distance(query_vector).label("distance")

    results = (
        db.query(JournalEntry, distance_col)
        .order_by(distance_col.asc())
        .limit(limit)
        .all()
    )

    output: List[Dict[str, Any]] = []
    for entry, dist in results:
        dist_float = float(dist)
        sim_float = round(1.0 - dist_float, 4)

        if threshold is not None and sim_float < threshold:
            continue

        output.append({
            "id": entry.id,
            "title": entry.title,
            "content": entry.content,
            "chunk_index": entry.chunk_index,
            "distance": round(dist_float, 4),
            "similarity": sim_float,
            "created_at": entry.created_at,
        })

    return output

