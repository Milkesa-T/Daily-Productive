"""
Day 18: Interactive RAG Testing
Run: python scripts/test_rag.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.services.rag import generate_rag_answer

TEST_QUESTIONS = [
    # 1. Should find the OAuth chunk and explain the PyJWT bug
    "What bug did I fix in the sprint and what was the root cause?",

    # 2. Should find the workout chunk and state 5km and target sleep
    "How much did I run and what is my sleep target tonight?",

    # 3. Should say: "I don't have enough information in your journal to answer that."
    "Where did I travel last summer?"
]

def main():
    print("=" * 70)
    print("TESTING RAG PIPELINE (RETRIEVAL + AUGMENTATION + GEMINI GENERATION)")
    print("=" * 70)

    db = SessionLocal()
    try:
        for i, q in enumerate(TEST_QUESTIONS, 1):
            print(f"\n❓ Question {i}: {q}")
            result = generate_rag_answer(db=db, question=q)
            print(f"🤖 Answer: {result['answer']}")
            print(f"📚 Sources used: {len(result['sources'])} chunk(s)")
            for s in result['sources']:
                print(f"   - '{s['title']}' (chunk {s['chunk_index']}, similarity: {s['similarity']:.2f})")
            print("-" * 70)
    finally:
        db.close()

if __name__ == "__main__":
    main()