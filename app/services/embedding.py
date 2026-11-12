import math
from typing import List
from google import genai
from app.core.config import settings

# Initialize Gemini Client
_client = None

def get_gemini_client() -> genai.Client:
    global _client
    if _client is None:
        if not settings.gemini_api_key:
            raise ValueError("GEMINI_API_KEY is not configured in settings/.env")
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


def chunk_text(text: str, chunk_size: int = 300, chunk_overlap: int = 50) -> List[str]:
    """
    Splits text into chunks of roughly `chunk_size` characters with `chunk_overlap`.
    Splits cleanly on whitespace so words are never cut in half.
    """
    if not text or not text.strip():
        return []

    words = text.split()
    chunks = []
    current_chunk = []
    current_length = 0

    for word in words:
        word_len = len(word) + 1  # word + space
        if current_length + word_len > chunk_size and current_chunk:
            # Save the current chunk
            chunk_str = " ".join(current_chunk)
            chunks.append(chunk_str)

            # Keep the last few words for overlap
            overlap_words = []
            overlap_len = 0
            for w in reversed(current_chunk):
                if overlap_len + len(w) + 1 <= chunk_overlap:
                    overlap_words.insert(0, w)
                    overlap_len += len(w) + 1
                else:
                    break
            
            current_chunk = overlap_words + [word]
            current_length = sum(len(w) + 1 for w in current_chunk)
        else:
            current_chunk.append(word)
            current_length += word_len

    if current_chunk:
        chunks.append(" ".join(current_chunk))

    return chunks


def get_embedding(text: str, dimensions: int = 768) -> List[float]:
    """
    Calls Gemini API to generate a dense vector embedding.
    Standardized to 768 dimensions for pgvector compatibility.
    """
    client = get_gemini_client()
    response = client.models.embed_content(
        model="gemini-embedding-001",
        contents=text,
        config={"output_dimensionality": dimensions}
    )
    return response.embeddings[0].values


def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """
    Calculates the cosine similarity between two vectors:
    dot_product(A, B) / (norm(A) * norm(B))
    Returns a score between -1.0 and 1.0 (closer to 1.0 = highly similar).
    """
    if len(vec_a) != len(vec_b):
        raise ValueError("Vectors must have the same dimension")

    dot_product = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))

    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0

    return dot_product / (norm_a * norm_b)