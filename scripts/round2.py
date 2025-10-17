# scripts/round2.py
import sqlite3, os, requests, time
from dotenv import load_dotenv
load_dotenv()

DB_PATH = os.environ.get("DB_PATH", "../data/deploy.db")
EVAL_URL = os.environ.get("EVALUATION_URL", "http://localhost:4000/evaluation/notify")

def get_passed_repos():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT email FROM repos")  # or join with results table to filter passed
    rows = cur.fetchall()
    conn.close()
    return [r[0] for r in rows]

def send_round2_task(email):
    payload = {
        "email": email,
        "secret": os.environ.get("SHARED_SECRET", "replace_me"),
        "task": "round2-task",
        "round": 2,
        "nonce": str(time.time()),
        "brief": "Round 2: generate a site that visualizes your previous results in a chart",
        "checks": ["Chart displays total correctly", "MIT license", "README present"],
        "evaluation_url": EVAL_URL
    }
    try:
        r = requests.post(EVAL_URL, json=payload, timeout=30)
        print(email, r.status_code)
    except Exception as e:
        print(email, "error:", e)

def main():
    emails = get_passed_repos()
    for email in emails:
        send_round2_task(email)
        time.sleep(1)

if __name__ == "__main__":
    main()
