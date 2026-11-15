"""
Day 18: RAG Evaluation Benchmark (10 Questions)
Measures Retrieval Faithfulness & Hallucination Resistance.
Run from root: python scripts/evaluate_rag.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.services.rag import generate_rag_answer

BENCHMARK_QUESTIONS = [
    # --- Category A: In-Domain (Answerable from Journal) ---
    {
        "id": 1,
        "question": "What bug blocked user registration and how was it solved?",
        "type": "in_domain",
        "expected_keywords": ["oauth", "token", "pyjwt"],
    },
    {
        "id": 2,
        "question": "How long did it take to debug the OAuth issue?",
        "type": "in_domain",
        "expected_keywords": ["2 hours", "two hours", "hours"],
    },
    {
        "id": 3,
        "question": "What chunk size did we choose for our RAG pipeline?",
        "type": "in_domain",
        "expected_keywords": ["300"],
    },
    {
        "id": 4,
        "question": "How far did I run in the evening workout and in what time?",
        "type": "in_domain",
        "expected_keywords": ["5km", "26 minutes", "5 km"],
    },
    {
        "id": 5,
        "question": "What muscle groups were targeted in the strength workout?",
        "type": "in_domain",
        "expected_keywords": ["back", "shoulder"],
    },

    # --- Category B: Out-of-Domain / Unanswerable (Must NOT Hallucinate) ---
    {
        "id": 6,
        "question": "What did I eat for breakfast this morning?",
        "type": "out_of_domain",
        "expected_keywords": ["don't have enough information", "not enough information"],
    },
    {
        "id": 7,
        "question": "What is my favorite programming language?",
        "type": "out_of_domain",
        "expected_keywords": ["don't have enough information", "not enough information"],
    },
    {
        "id": 8,
        "question": "Where did I travel on vacation last year?",
        "type": "out_of_domain",
        "expected_keywords": ["don't have enough information", "not enough information"],
    },
    {
        "id": 9,
        "question": "How much money did I spend on groceries yesterday?",
        "type": "out_of_domain",
        "expected_keywords": ["don't have enough information", "not enough information"],
    },
    {
        "id": 10,
        "question": "Who is my manager at work?",
        "type": "out_of_domain",
        "expected_keywords": ["don't have enough information", "not enough information"],
    },
]

def main():
    print("=" * 75)
    print("DAY 18: RAG 10-QUESTION BENCHMARK EVALUATION")
    print("=" * 75)

    db = SessionLocal()
    passed = 0
    total = len(BENCHMARK_QUESTIONS)

    try:
        for item in BENCHMARK_QUESTIONS:
            q_id = item["id"]
            q_text = item["question"]
            q_type = item["type"]
            expected = item["expected_keywords"]

            result = generate_rag_answer(db=db, question=q_text)
            answer = result["answer"].strip()
            answer_lower = answer.lower()

            # Evaluation logic
            if q_type == "in_domain":
                # Must match at least one expected keyword and must NOT claim missing info
                has_keyword = any(kw.lower() in answer_lower for kw in expected)
                not_refused = "don't have enough information" not in answer_lower
                success = has_keyword and not_refused
            else:
                # Out-of-domain: MUST gracefully refuse without inventing facts
                success = "don't have enough information" in answer_lower or "not mentioned" in answer_lower

            if success:
                passed += 1
                status_icon = "✅ PASS"
            else:
                status_icon = "❌ FAIL"

            print(f"\n[{q_id:02d}/10] {status_icon} ({q_type.upper()})")
            print(f"  Q: \"{q_text}\"")
            print(f"  A: \"{answer}\"")
            print(f"  Sources: {len(result['sources'])} chunk(s)")

        score_pct = (passed / total) * 100
        print("\n" + "=" * 75)
        print(f"EVALUATION SUMMARY: {passed}/{total} Passed ({score_pct:.1f}%)")
        print("=" * 75)
        if score_pct >= 90:
            print("🏆 RAG pipeline meets production standards for groundedness & safety!")
        else:
            print("⚠️ Some questions failed groundedness checks.")
    finally:
        db.close()

if __name__ == "__main__":
    main()
