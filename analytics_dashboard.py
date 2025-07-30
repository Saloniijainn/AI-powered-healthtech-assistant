import pandas as pd
import matplotlib.pyplot as plt
from collections import Counter
import os

LOG_FILE = "logs/chat_log.csv"

# Check if log file exists
if not os.path.exists(LOG_FILE):
    print("❌ Log file not found. Run the chatbot first to generate logs.")
    exit()

# Load data
df = pd.read_csv(LOG_FILE, encoding="utf-8")

# Convert timestamp to datetime
df["Timestamp"] = pd.to_datetime(df["Timestamp"])

# --------------------
# 📊 Basic Metrics
# --------------------
total_queries = len(df)
avg_length = df["AnswerLength"].mean()
unique_questions = df["UserQuery"].nunique()

print("📈 Chatbot Usage Summary")
print("-" * 30)
print(f"Total Queries: {total_queries}")
print(f"Unique Questions: {unique_questions}")
print(f"Average Answer Length: {avg_length:.2f} characters")

# --------------------
# 🕒 Trend: Queries Per Day
# --------------------
df["Date"] = df["Timestamp"].dt.date
daily_counts = df["Date"].value_counts().sort_index()

plt.figure(figsize=(8, 4))
daily_counts.plot(kind="bar", color="#00b894")
plt.title("Queries Per Day")
plt.xlabel("Date")
plt.ylabel("Number of Queries")
plt.tight_layout()
plt.savefig("logs/queries_per_day.png")
plt.show()

# --------------------
# 🗣️ Most Frequent Questions
# --------------------
top_questions = df["UserQuery"].value_counts().head(5)

print("\n🔥 Top 5 Most Asked Questions:")
for i, (q, count) in enumerate(top_questions.items(), start=1):
    print(f"{i}. {q} ({count} times)")

# --------------------
# 📉 Longest Responses (Optional Insight)
# --------------------
print("\n📝 Longest Responses (Top 3):")
longest = df.sort_values(by="AnswerLength", ascending=False).head(3)[["UserQuery", "AnswerLength"]]
for idx, row in longest.iterrows():
    print(f"- {row['UserQuery']} → {row['AnswerLength']} chars")
