from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.services.embedding import get_gemini_client
from app.services.search import search_journal_entries

SYSTEM_PROMPT = """You are an intelligent personal productivity assistant for the Daily-Productive platform.
Your job is to answer the user's question using ONLY the provided journal excerpts below.

Strict Rules:
1. Ground every statement strictly in the provided Context excerpts.
2. If the excerpts do NOT contain the answer, reply EXACTLY:
   "I don't have enough information in your journal to answer that."
3. Do not assume, speculate, or extrapolate facts outside the context.
4. Keep your answer concise, direct, and helpful (2-4 sentences max).
5. When relevant, reference the entry title (e.g. "According to your OAuth entry...").
"""


def format_context(chunks: List[Dict[str, Any]]) -> str:
    """Formats retrieved database chunks into a numbered context block for the LLM."""
    if not chunks:
        return "No relevant journal entries found."

    context_lines = []
    for i, c in enumerate(chunks, 1):
        title = c.get("title") or "Untitled"
        sim = c.get("similarity", 0.0)
        content = c.get("content", "").strip()
        context_lines.append(f"[{i}] Entry: '{title}' (Relevance: {sim:.2f})\nContent: {content}\n")

    return "\n".join(context_lines)


def generate_rag_answer(
    db: Session,
    question: str,
    top_k: int = 3,
    min_similarity: float = 0.40,
    model_name: str = "gemini-flash-lite-latest"
) -> Dict[str, Any]:
    """
    Full RAG pipeline:
    1. Retrieve: Fetches top-k semantically relevant chunks via pgvector.
    2. Augment: Injects the chunks into a grounded prompt template.
    3. Generate: Calls Gemini to produce a factual, grounded response.
    """
    clean_question = question.strip()
    if not clean_question:
        return {
            "question": question,
            "answer": "Please provide a valid question.",
            "sources": []
        }

    # Step 1: RETRIEVAL using pgvector from Day 17
    retrieved_chunks = search_journal_entries(
        db=db,
        query=clean_question,
        limit=top_k,
        threshold=min_similarity
    )

    # If nothing relevant passed the similarity threshold, short-circuit
    if not retrieved_chunks:
        return {
            "question": clean_question,
            "answer": "I don't have enough information in your journal to answer that.",
            "sources": []
        }

    # Step 2: AUGMENTATION (Building the prompt)
    context_text = format_context(retrieved_chunks)
    prompt = f"""Context from user's journal:
----------------------------------------
{context_text}
----------------------------------------

User Question: {clean_question}

Answer:"""

    # Step 3: GENERATION (Calling Gemini)
    client = get_gemini_client()
    response = client.models.generate_content(
        model=model_name,
        contents=prompt,
        config={
            "system_instruction": SYSTEM_PROMPT,
            "temperature": 0.2,  # Low temperature = more factual, less creative
        }
    )

    return {
        "question": clean_question,
        "answer": response.text.strip(),
        "sources": [
            {
                "id": c["id"],
                "title": c.get("title"),
                "chunk_index": c.get("chunk_index"),
                "similarity": c.get("similarity"),
                "snippet": c.get("content", "")[:100] + "..."
            }
            for c in retrieved_chunks
        ]
    }