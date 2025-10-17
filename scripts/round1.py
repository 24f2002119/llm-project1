import csv, requests, uuid, time, json
from urllib.parse import urljoin
from dotenv import load_dotenv
import os, base64

load_dotenv()
SUBMISSION_CSV = os.environ.get("SUBMISSION_CSV", os.path.join(".", "submission.csv"))
EVALUATION_URL = os.environ.get("EVALUATION_URL", "http://localhost:4000/evaluation/notify")

def make_task(email, secret, template_id="sum-of-sales", seed=None):
    if seed is None: seed = int(time.time()) % 100000
    task = f"{template_id}-{str(seed)[:5]}"
    nonce = str(uuid.uuid4())
    brief = f"Publish a single-page site that fetches data.csv from attachments, sums its sales column, sets the title to 'Sales Summary {seed}', displays the total inside #total-sales, and loads Bootstrap 5 from jsdelivr."
    checks = [
        "Repo has MIT license",
        "README.md is professional",
        "Page displays total inside #total-sales"
    ]
    # Example CSV content
    csv_content = "product,sale\nA,100\nB,50\n"
    attachments = [{"name": "data.csv", "url": "data:text/csv;base64," + base64.b64encode(csv_content.encode()).decode()}]

    return {
        "email": email,
        "secret": secret,
        "task": task,
        "round": 1,
        "nonce": nonce,
        "brief": brief,
        "checks": checks,
        "evaluation_url": EVALUATION_URL,
        "attachments": attachments
    }

def post_task(endpoint, payload, retries=3):
    for attempt in range(retries):
        try:
            r = requests.post(endpoint, json=payload, timeout=30)
            return r.status_code, r.text
        except Exception as e:
            print(f"Attempt {attempt+1} failed: {e}")
            time.sleep(2 ** attempt)
    return None, "Failed after retries"

def main():
    rows = []
    with open(SUBMISSION_CSV) as f:
        for r in csv.DictReader(f):
            rows.append(r)
    for r in rows:
        endpoint = r['endpoint']
        email = r['email']
        secret = r['secret']
        payload = make_task(email, secret)
        code, text = post_task(endpoint, payload)
        print("POST", endpoint, "=>", code)
        time.sleep(1)

if __name__ == "__main__":
    main()
