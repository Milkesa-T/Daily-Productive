"""
Day 15 Experiment: Chunking Strategies & Semantic Similarity
Run from project root: python scripts/embedding_experiment.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.embedding import chunk_text, get_embedding, cosine_similarity

SAMPLE_JOURNAL = """
Today was a productive sprint day. I fixed the OAuth bug that was blocking 
user registration. The issue was in the token validation middleware where 
expired tokens were not being caught properly. After debugging for 2 hours, 
I found the root cause: PyJWT's decode function requires explicit algorithm 
specification to prevent algorithm confusion attacks.

I also made progress on the RAG pipeline design. The key insight is that 
chunk size dramatically affects retrieval quality. Smaller chunks give more 
precise answers but lose context. Larger chunks preserve context but dilute 
the semantic focus of the vector.

Had a good workout session in the evening. Ran 5km and did 30 minutes of 
strength training. Sleep target is 8 hours tonight to recover.
"""

QUERY = "What bug did I fix today?"
UNRELATED = "What is the weather like in Paris?"

print("=" * 60)
print("CHUNKING EXPERIMENT")
print("=" * 60)

for size in [100, 300, 600]:
    chunks = chunk_text(SAMPLE_JOURNAL, chunk_size=size, chunk_overlap=50)
    avg_len = sum(len(c) for c in chunks) / len(chunks) if chunks else 0
    print(f"\nChunk size={size}: {len(chunks)} chunks, avg length={avg_len:.0f} chars")
    for i, c in enumerate(chunks):
        print(f"  [{i+1}] {c[:80]}{'...' if len(c) > 80 else ''}")

print("\n" + "=" * 60)
print("SEMANTIC SIMILARITY EXPERIMENT")
print("=" * 60)

query_vec = get_embedding(QUERY)
unrelated_vec = get_embedding(UNRELATED)

chunks = chunk_text(SAMPLE_JOURNAL, chunk_size=300, chunk_overlap=50)
print(f"\nQuery:     '{QUERY}'")
print(f"Unrelated: '{UNRELATED}'")
print()
for i, chunk in enumerate(chunks):
    chunk_vec = get_embedding(chunk)
    sim_query = cosine_similarity(query_vec, chunk_vec)
    sim_unrelated = cosine_similarity(unrelated_vec, chunk_vec)
    print(f"Chunk {i+1}: query_sim={sim_query:.4f} | unrelated_sim={sim_unrelated:.4f}")
    print(f"  Text: {chunk[:80]}...")

print("\n" + "=" * 60)
print("KEY TAKEAWAYS")
print("=" * 60)
print("- chunk_size=100 → more chunks, precise, but loses sentence context")
print("- chunk_size=300 → balanced; good for RAG retrieval (our default)")
print("- chunk_size=600 → fewer chunks, retains context, but dilutes semantic focus")
print("- Query-similar chunks should score HIGHER than unrelated ones → RAG works!")

