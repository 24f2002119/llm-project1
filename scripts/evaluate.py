import sqlite3, os, time, requests
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv

load_dotenv()

DB_PATH = os.environ.get("DB_PATH", "../data/deploy.db")
SLEEP_BETWEEN = 1  # seconds

def get_repos_to_eval():
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()
        cur.execute("SELECT id,email,task,round,repo_url,commit_sha,pages_url FROM repos")
        return cur.fetchall()

def check_license(repo_url):
    if repo_url.startswith("https://github.com/"):
        parts = repo_url.replace("https://github.com/","").strip("/").split("/")
        if len(parts) >= 2:
            owner, repo = parts[0], parts[1]
            for branch in ["main", "master"]:
                raw = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/LICENSE"
                try:
                    r = requests.get(raw, timeout=10)
                    if r.ok and "MIT License" in r.text:
                        return True, f"MIT found on {branch}"
                except Exception as e:
                    return False, f"Error fetching LICENSE: {e}"
            return False, "No MIT found on main/master"
    return False, "Not a github repo"

def run_playwright_check(pages_url):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            page.goto(pages_url, timeout=20000)
            if page.query_selector("#total-sales") or page.query_selector("#brief"):
                return True, "Required element exists"
            return False, "Element missing"
        except Exception as e:
            return False, f"Error loading page: {e}"
        finally:
            browser.close()

def main():
    rows = get_repos_to_eval()
    for r in rows:
        id, email, task, round_, repo_url, commit_sha, pages_url = r
        print("Evaluating", repo_url)
        ok_license, reason_license = check_license(repo_url)
        ok_page, reason_page = run_playwright_check(pages_url)
        print("License:", ok_license, reason_license)
        print("Page check:", ok_page, reason_page)
        time.sleep(SLEEP_BETWEEN)

if __name__ == "__main__":
    main()
