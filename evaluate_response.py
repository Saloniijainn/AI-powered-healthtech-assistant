from sentence_transformers import SentenceTransformer, util

# Load embedding model for evaluation
evaluation_model = SentenceTransformer("all-MiniLM-L6-v2")

# Cosine similarity between query and answer (semantic relevance)
def evaluate_relevance(query, answer):
    embeddings = evaluation_model.encode([query, answer], convert_to_tensor=True)
    score = util.cos_sim(embeddings[0], embeddings[1]).item()
    return round(score, 4)

# Cosine similarity between context and answer (faithfulness)
def evaluate_faithfulness(context_text, answer):
    embeddings = evaluation_model.encode([context_text, answer], convert_to_tensor=True)
    score = util.cos_sim(embeddings[0], embeddings[1]).item()
    return round(score, 4)

# ✅ Unified function for logging both
def evaluate(query, answer, context_text):
    return {
        "relevance_score": evaluate_relevance(query, answer),
        "faithfulness_score": evaluate_faithfulness(context_text, answer)
    }
