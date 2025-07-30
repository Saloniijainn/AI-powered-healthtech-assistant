import csv
import os
from datetime import datetime

# Log file path
LOG_FILE = "logs/chat_log.csv"

# Initialize CSV with proper headers
def init_logger():
    # Ensure the 'logs' directory exists
    if not os.path.exists(os.path.dirname(LOG_FILE)):
        os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)

    # Create the CSV file with headers if it doesn't exist
    if not os.path.exists(LOG_FILE):
        with open(LOG_FILE, "w", newline='', encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "Timestamp",
                "UserQuery",
                "Answer",
                "AnswerLength",
                "RelevanceScore",
                "FaithfulnessScore",
                "UserFeedback",       # For thumbs up/down
                "MessageID",          # Unique ID for the message
                "Escalated",          # Whether query was escalated
                "EscalationReason"    # Reason for escalation
            ])

# Append a new row to the log for general queries
def log_query(query, answer, relevance=None, faithfulness=None, feedback=None):
    with open(LOG_FILE, "a", newline='', encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            query,
            answer,
            len(answer) if answer else 0,
            relevance if relevance is not None else "",
            faithfulness if faithfulness is not None else "", # Corrected parameter name
            feedback if feedback else "",
            "", # MessageID (N/A for general query logs)
            "", # Escalated (N/A)
            ""  # EscalationReason (N/A)
        ])

# Append a new row to the log specifically for user feedback from the frontend
def log_feedback(query, response, feedback, message_id, escalated=False, escalation_reason=None):
    with open(LOG_FILE, "a", newline='', encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            query,
            response,
            len(response) if response else 0,
            "", # RelevanceScore (N/A for feedback logs)
            "", # FaithfulnessScore (N/A)
            feedback,
            message_id,
            "Yes" if escalated else "No",
            escalation_reason if escalation_reason else ""
        ])

# You might want to call init_logger() here if logger.py is imported directly
# and you want to ensure the log file is ready immediately on import.
# However, usually it's called explicitly from the main entry point (e.g., api.py or rag_pipeline.py CLI)
# if __name__ == "__main__":
#     init_logger()
#     # Example usage for testing:
#     log_query("Test query", "This is a test answer", 0.8, 0.9, "👍")
#     log_feedback("Another query", "Another response", "👎", "msg123", True, "Bot confused")