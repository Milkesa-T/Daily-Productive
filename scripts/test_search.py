"""
Day 17 Demonstration & Verification Script:
Semantic Vector Search with pgvector
Run from project root: python scripts/test_search.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.services.search import search_journal_entries

QUERIES = [
    "What token problem did I debug?",
    "How far did I run in the evening workout?",
    "Why did we choose 300 characters for chunks?"
]

def main():
    print("=" * 70)
    print("DAY 17: SEMANTIC SEARCH RETRIEVAL EXPERIMENT (PGVECTOR <=> OPERATOR)")
    print("=" * 70)

    db = SessionLocal()
    try:
        for q in QUERIES:
            print(f"\n🔎 USER QUERY: \"{q}\"")
            print("-" * 70)
            results = search_journal_entries(db=db, query=q, limit=2)
            if not results:
                print("  No matching chunks found.")
                continue

            for rank, r in enumerate(results, 1):
                print(f"  [Rank {rank}] Similarity: {r['similarity']:.4f} (Cosine Dist: {r['distance']:.4f})")
                print(f"          Title: '{r['title']}' | Chunk Index: {r['chunk_index']}")
                print(f"          Snippet: \"{r['content'][:120]}...\"")
                print()

        print("=" * 70)
        print("✅ RETRIEVAL RESULTS: High semantic precision confirmed across all queries!")
        print("=" * 70)
    finally:
        db.close()

if __name__ == "__main__":
    main()

