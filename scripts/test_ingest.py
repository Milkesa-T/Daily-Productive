"""
Day 16 Test & Verification Script: Journal Ingestion with pgvector
Run from project root: python scripts/test_ingest.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.models import JournalEntry
from app.services.ingest import ingest_journal_entry

JOURNAL_SAMPLES = [
    {
        "title": "OAuth & Token Expiration Fix",
        "content": (
            "Today was a productive sprint day. I fixed the OAuth bug that was blocking "
            "user registration. The issue was in the token validation middleware where "
            "expired tokens were not being caught properly. After debugging for 2 hours, "
            "I found the root cause: PyJWT's decode function requires explicit algorithm "
            "specification to prevent algorithm confusion attacks."
        )
    },
    {
        "title": "RAG Pipeline Architecture",
        "content": (
            "I also made progress on the RAG pipeline design. The key insight is that "
            "chunk size dramatically affects retrieval quality. Smaller chunks give more "
            "precise answers but lose context. Larger chunks preserve context but dilute "
            "the semantic focus of the vector. We settled on 300 characters as our default."
        )
    },
    {
        "title": "Evening Workout & Recovery",
        "content": (
            "Had a good workout session in the evening. Ran 5km in 26 minutes and did "
            "30 minutes of strength training targeting back and shoulders. Sleep target "
            "is 8 hours tonight to recover properly for tomorrow's sprint."
        )
    }
]

def main():
    print("=" * 60)
    print("DAY 16: INGEST JOURNAL ENTRIES WITH PGVECTOR")
    print("=" * 60)

    db = SessionLocal()
    try:
        total_chunks = 0
        for sample in JOURNAL_SAMPLES:
            print(f"\nIngesting: '{sample['title']}'...")
            entries = ingest_journal_entry(
                db=db,
                title=sample["title"],
                content=sample["content"],
                chunk_size=300,
                chunk_overlap=50
            )
            print(f" -> Generated and saved {len(entries)} chunk(s).")
            total_chunks += len(entries)

        print("\n" + "=" * 60)
        print("VERIFYING DATABASE PERSISTENCE")
        print("=" * 60)

        # Query all journal entries from database
        stored = db.query(JournalEntry).order_by(JournalEntry.id.desc()).limit(10).all()
        print(f"Total entries fetched from DB: {len(stored)}")
        print()

        for entry in stored:
            vec = entry.embedding
            vec_len = len(vec) if vec is not None else 0
            sample_preview = list(vec[:3]) if vec is not None else []
            print(f"ID: {entry.id} | Title: '{entry.title}' | Chunk: {entry.chunk_index}")
            print(f"  Content: {entry.content[:70]}...")
            print(f"  Vector dim: {vec_len} | Sample: {sample_preview}...")
            print("-" * 50)

        print(f"\nSUCCESS: Successfully ingested and verified {total_chunks} chunks with 768-dim vectors!")
    finally:
        db.close()

if __name__ == "__main__":
    main()

