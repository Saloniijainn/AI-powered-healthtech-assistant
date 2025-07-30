from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os

# --- IMPORTANT PATH ADJUSTMENT ---
# Get the directory where api.py is located (e.g., C:\Users\Saloni Jain\Desktop\WELLEAZY-CHATBOT\)
current_api_dir = os.path.dirname(os.path.abspath(__file__))

# Construct the full path to the 'scripts' directory
scripts_dir_path = os.path.join(current_api_dir, 'scripts')

# Add the 'scripts' directory to Python's search path
sys.path.append(scripts_dir_path)
# --- END PATH ADJUSTMENT ---

from rag_pipeline import cached_chat
from logger import log_feedback

app = Flask(__name__)
CORS(app) # Enable CORS for all routes

@app.route("/ask", methods=["POST"])
def ask_question():
    """
    Handles incoming chat queries, processes them using the RAG pipeline,
    and returns the answer along with metadata.
    """
    try:
        data = request.get_json()
        query = data.get("query")

        if not query:
            return jsonify({"error": "Query not provided"}), 400

        # Call the RAG pipeline's chat function
        answer, context, metrics = cached_chat(query)

        # Determine if escalation is needed based on bot's answer
        escalate = False
        escalation_reason = None

        # Check if the answer contains phrases indicating the bot couldn't find info
        # These phrases come from rag_pipeline.py's guardrails
        low_confidence_phrases = [
            "This question appears to be outside the scope",
            "Sorry, I couldn't generate a confident answer",
            "I'm sorry, but I couldn't find reliable information",
            "I'm experiencing technical difficulties connecting to our servers."
        ]

        # Use an all() check to ensure answer is not empty AND contains one of the phrases
        if answer and any(phrase in answer for phrase in low_confidence_phrases):
            escalate = True
            escalation_reason = "Bot's answer indicated low confidence or out-of-scope."

        # --- REMOVED REDUNDANT CONTACT INFO APPENDING ---
        # The rag_pipeline.py already includes the contact info if escalation is needed.
        # This block is no longer necessary and was causing duplication.
        # if escalate and "contact our support team" not in answer.lower():
        #     answer += "\n\nFor more details or direct assistance, please contact our support team:\n📞 +91-88840 00687\n📧 support@welleazy.com"
        # --- END REMOVAL ---

        return jsonify({
            "answer": answer,
            "context": context,
            "metrics": metrics,
            "escalate": escalate,
            "escalation_reason": escalation_reason
        })

    except Exception as e:
        app.logger.error(f"Error processing /ask request: {e}", exc_info=True)
        # Return generic error message, consistent with UI for backend errors
        return jsonify({
            "error": "An internal server error occurred.",
            "escalate": True,
            "escalation_reason": f"Backend internal error: {str(e)}",
            "contact_info": { # Provide structured contact info for frontend
                "phone": "+91-88840 00687",
                "email": "support@welleazy.com"
            }
        }), 500

@app.route("/log_feedback", methods=["POST"])
def log_user_feedback():
    """
    Receives and logs user feedback for bot responses.
    """
    try:
        data = request.get_json()
        message_id = data.get("messageId")
        feedback = data.get("feedback") # '👍' or '👎'
        query = data.get("query")
        bot_response = data.get("botResponse")
        escalated = data.get("escalated", False)
        escalation_reason = data.get("escalationReason")

        if not all([message_id, feedback, query, bot_response]):
            return jsonify({"error": "Missing required feedback data"}), 400

        log_feedback(
            query=query,
            response=bot_response,
            feedback=feedback,
            message_id=message_id,
            escalated=escalated,
            escalation_reason=escalation_reason
        )

        return jsonify({"status": "Feedback logged successfully"}), 200

    except Exception as e:
        app.logger.error(f"Error logging feedback: {e}", exc_info=True)
        return jsonify({"error": "An internal server error occurred while logging feedback"}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)