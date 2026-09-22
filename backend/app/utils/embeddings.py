
import re
import threading
from typing import List
try:
    from langchain_core.embeddings import Embeddings
except ImportError:
    class Embeddings:
        pass
from app.config import settings as global_setting

_cached_embeddings = None
_embeddings_lock = threading.Lock()

def get_embedding_model():
    global _cached_embeddings
    with _embeddings_lock:
        if _cached_embeddings is not None:
            return _cached_embeddings
        try:
            from langchain_huggingface import HuggingFaceEmbeddings as HFEmbeddings
            print(f"Loading embedding model: {global_setting.EMBED_MODEL}")
            _cached_embeddings = HFEmbeddings(
                model_name=global_setting.EMBED_MODEL,
                model_kwargs={"device": "cpu"},
            )
            return _cached_embeddings
        except Exception as e:
            print(f" Embeddings backend unavailable; using fallback embeddings. Error: {e}")

            class FallbackEmbeddings(Embeddings):
                def _text_to_vector(self, text: str) -> List[float]:
                    words = re.findall(r"\w+", text.lower())
                    dims = 128
                    vec = [0.0] * dims
                    for word in words:
                        idx = sum(ord(c) for c in word) % dims
                        vec[idx] += 1.0
                    norm = sum(v * v for v in vec) ** 0.5
                    if norm > 0:
                        vec = [v / norm for v in vec]
                    return vec

                def embed_documents(self, texts: List[str]) -> List[List[float]]:
                    return [self._text_to_vector(text) for text in texts]

                def embed_query(self, text: str) -> List[float]:
                    return self._text_to_vector(text)

            return FallbackEmbeddings()
