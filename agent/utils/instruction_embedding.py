import gc
import threading

from sentence_transformers import SentenceTransformer


MODEL_NAME = 'BAAI/bge-small-en-v1.5'
EMBEDDING_DIM = 384
DEVICE = 'cpu'


_model = None
_model_lock = threading.RLock()


def load_model():
    global _model

    with _model_lock:
        if _model is None:
            _model = SentenceTransformer(
                MODEL_NAME,
                device=DEVICE
            )

        return _model


def unload_model():
    global _model

    with _model_lock:
        if _model is None:
            return

        del _model
        _model = None

        gc.collect()


def is_model_loaded():
    return _model is not None


def embed_text(text: str) -> list[float]:
    model = load_model()

    embedding = model.encode(
        text,
        normalize_embeddings=True,
        convert_to_numpy=True
    )

    return embedding.tolist()


def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []

    model = load_model()

    embeddings = model.encode(
        texts,
        batch_size=8,
        normalize_embeddings=True,
        convert_to_numpy=True
    )

    return embeddings.tolist()


def _to_pgvector(embedding: list[float]) -> str:
    return (
        '['
        + ','.join(str(float(value)) for value in embedding)
        + ']'
    )