import json
import re
import uuid

# Load scraped data
with open('data/welleazy_scraped_data.json', 'r', encoding='utf-8') as f:
    raw_data = json.load(f)

def clean_text(text):
    text = re.sub(r'\s+', ' ', text)
    text = text.replace('\u200b', '').strip()
    return text

def chunk_text(text, max_tokens=300):
    sentences = text.split('. ')
    chunks, current = [], ''
    for sentence in sentences:
        if len((current + sentence).split()) > max_tokens:
            chunks.append(current.strip())
            current = sentence
        else:
            current += sentence + '. '
    if current.strip():
        chunks.append(current.strip())
    return chunks

chunked_data = []

for page in raw_data:
    clean = clean_text(page['content'])
    chunks = chunk_text(clean)
    for i, chunk in enumerate(chunks):
        chunked_data.append({
            "id": str(uuid.uuid4()),
            "url": page['url'],
            "title": page['title'],
            "chunk_index": i,
            "content": chunk
        })

# Save to new file
with open("data/welleazy_chunks.json", "w", encoding='utf-8') as f:
    json.dump(chunked_data, f, ensure_ascii=False, indent=2)

print(f"✅ Total chunks created: {len(chunked_data)}")
import faiss
import numpy as np
import openai
from sentence_transformers import SentenceTransformer
from scripts.evaluate_response import evaluate
from functools import lru_cache
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")

# Load metadata
with open("vector_store/welleazy_metadata.json", "r", encoding="utf-8") as f:
    metadata = json.load(f)

# Load FAISS index and embedding model
index = faiss.read_index("vector_store/welleazy_index.faiss")
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

# 🔍 Search top-k relevant chunks
def search(query, k=5):
    query_embedding = embedding_model.encode(query).astype("float32")
    distances, indices = index.search(np.array([query_embedding]), k)
    return [metadata[i] for i in indices[0]]

# 🧠 Prompt builder
def build_prompt(query, retrieved_chunks):
    context = "\n\n".join([f"- {chunk['content']}" for chunk in retrieved_chunks])
    prompt = (
        "You are an intelligent, articulate, and helpful assistant for Welleazy — a leading corporate healthtech company in India.\n"
        "Your role is to assist users by answering their queries using the company’s website content.\n"
        "Always provide professional, precise, and complete answers.\n"
        "Do NOT make up information. Only use the information provided in the context below.\n\n"
        f"=== CONTEXT ===\n{context}\n\n"
        "=== INSTRUCTIONS ===\n"
        "1. Understand the user's question carefully.\n"
        "2. Use only the provided context to answer — no outside knowledge.\n"
        "3. Give a concise yet informative response.\n"
        "4. If the answer is not in the context, politely say so.\n\n"
        f"=== USER QUESTION ===\n{query}\n\n"
        "=== ANSWER ==="
    )
    return prompt

# 🧠 Chat function
def chat(query):
    top_chunks = search(query, k=3)

    if not top_chunks or all(len(chunk["content"].strip()) == 0 for chunk in top_chunks):
        return "I'm sorry, I couldn't find any information related to that question on the Welleazy website.", None, None

    context_text = "\n\n".join([chunk["content"] for chunk in top_chunks])
    prompt = build_prompt(query, top_chunks)

    try:
        response = openai.ChatCompletion.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a helpful assistant for the Welleazy website. Use only the provided context."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            max_tokens=512
        )

        answer = response["choices"][0]["message"]["content"].strip()

        if not answer or "I'm not sure" in answer or len(answer) < 20:
            return "Sorry, I couldn't find a confident answer based on the available content.", context_text, None

        metrics = evaluate(query, answer, context_text)
        return answer, context_text, metrics

    except Exception as e:
        return f"⚠️ An error occurred while generating the response: {str(e)}", None, None

# ✅ This is what your api.py expects to import
@lru_cache(maxsize=100)
def cached_chat(query):
    return chat(query)
