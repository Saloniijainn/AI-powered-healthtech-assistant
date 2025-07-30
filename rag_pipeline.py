import os
import json
import faiss
import numpy as np
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
from functools import lru_cache
import openai
import sys

# Add script paths
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from scripts.logger import init_logger, log_query
from scripts.evaluate_response import evaluate

# Load environment variables
load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")

# Load metadata
with open("vector_store/welleazy_metadata.json", "r", encoding="utf-8") as f:
    metadata = json.load(f)

# Load FAISS index and embedding model
index = faiss.read_index("vector_store/welleazy_index.faiss")
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

# Track previous answer for Human-in-the-Loop
last_answer = None

#  Search top-k relevant chunks
def search(query, k=5):
    query_embedding = embedding_model.encode(query).astype("float32")
    distances, indices = index.search(np.array([query_embedding]), k)
    return [metadata[i] for i in indices[0]]

#  Prompt builder
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

def chat(query):
    global last_answer

    # Human-in-the-Loop handling
    vague_starters = ["what about", "is it", "does that", "is that", "how about", "what does it", "is it"]
    if any(query.lower().startswith(start) for start in vague_starters) and last_answer:
        query = f"{query} (Referring to: {last_answer})"

    # Chunk search
    top_chunks = search(query, k=3)

    # Guardrail 1: Out-of-context fallback
    if not top_chunks or all(len(chunk["content"].strip()) == 0 for chunk in top_chunks):
        return (
            "❌ This question appears to be outside the scope of Welleazy's website content.\n\n"
            "I'm here to assist with information available on Welleazy’s official services and offerings.\n\n"
            "For more details or questions beyond this scope, you can contact our support team:\n\n"
            "📞 +91-9071167676\n📧 hello@welleazy.com",
            None,
            None
        )

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

        # Guardrail 2: Weak response fallback
        if not answer or "I'm not sure" in answer or len(answer) < 20:
            return (
                "Sorry, I couldn't generate a confident answer based on Welleazy's website content.\n\n"
                "Please feel free to contact our support team for assistance:\n📞 +91-9071167676\n📧 hello@welleazy.com",
                context_text,
                None
            )

        # Store last answer for HiTL memory
        last_answer = answer

        # Evaluate LLM answer
        metrics = evaluate(query, answer, context_text)

        # 🚧 Guardrail 4: Extremely low faithfulness = hallucinated / out-of-context
        if metrics["faithfulness_score"] < 0.3:
            return (
                "I'm sorry, but I couldn't find reliable information for your question within Welleazy's website content.\n\n"
                "For more details, please contact our support team:\n"
                "📞 +91-9071167676\n📧 hello@welleazy.com",
                context_text,
                metrics
            )

        return answer, context_text, metrics

    except Exception as e:
        # 🚧 Guardrail 3: API failure
        return f"An error occurred while generating the response: {str(e)}", None, None

# Cache frequent queries
@lru_cache(maxsize=100)
def cached_chat(query):
    return chat(query)

#CLI interface for testing
if __name__ == "_main_":
    print("Welleazy Chatbot (GPT-4o-mini via OpenAI). Type 'exit' to quit.\n")
    init_logger()

    while True:
        user_input = input("Ask Welleazy 🤖: ")
        if user_input.lower() in ["exit", "quit"]:
            print("Exiting chatbot.")
            break

        try:
            answer, context, metrics = cached_chat(user_input)

            print(f"\nAnswer:\n{answer}")
            if metrics:
                print("\nEvaluation:")
                print(f"- Relevance Score   : {metrics['relevance_score']}")
                print(f"- Faithfulness Score: {metrics['faithfulness_score']}")

            feedback = input("\nWas this helpful? (y/n): ").strip().lower()
            feedback = "👍" if feedback == "y" else "👎"

            log_query(
                user_input,
                answer,
                metrics["relevance_score"] if metrics else None,
                metrics["faithfulness_score"] if metrics else None,
                feedback
            )

            print("\n" + "=" * 80 + "\n")

        except Exception as e:
            print(f"Error: {str(e)}\n")