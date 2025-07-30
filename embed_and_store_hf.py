import json
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

# Load chunks
with open("data/welleazy_chunks.json", "r", encoding="utf-8") as f:
    chunks = json.load(f)

# Load HF embedding model
model = SentenceTransformer('all-MiniLM-L6-v2')

# Init FAISS
embedding_dim = 384  # For this model
index = faiss.IndexFlatL2(embedding_dim)
metadata = []

for chunk in chunks:
    embedding = model.encode(chunk["content"])
    index.add(np.array([embedding]).astype('float32'))
    metadata.append({
        "id": chunk["id"],
        "url": chunk["url"],
        "title": chunk["title"],
        "chunk_index": chunk["chunk_index"],
        "content": chunk["content"]
    })

# Save vector index
faiss.write_index(index, "vector_store/welleazy_index.faiss")

# Save metadata
with open("vector_store/welleazy_metadata.json", "w", encoding='utf-8') as f:
    json.dump(metadata, f, ensure_ascii=False, indent=2)

print(f"✅ Stored {len(metadata)} embeddings using HuggingFace model")
