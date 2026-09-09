#!/usr/bin/env python3
"""Push all files to GitHub repo via Contents API."""
import os, sys, json, urllib.request, urllib.parse, time

TOKEN = sys.argv[1]
OWNER = sys.argv[2]
REPO = sys.argv[3]
branch = sys.argv[4] if len(sys.argv) > 4 else "main"
BASE = f"https://api.github.com/repos/{OWNER}/{REPO}"

def gh(path, method="GET", data=None):
    url = f"{BASE}{path}"
    headers = {
        "Authorization": f"token {TOKEN}",
        "Accept": "application/vnd.github+json",
    }
    body = json.dumps(data).encode() if data else None
    if body:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            body = r.read()
            if not body:
                return r.status, {}
            return r.status, json.loads(body)
    except urllib.error.HTTPError as e:
        try:
            body = e.read()
            if not body:
                return e.code, {}
            return e.code, json.loads(body)
        except:
            return e.code, {}

def main():
    # Check if repo exists
    status, info = gh("")
    if status == 404:
        print("ERROR: repo not found or no access")
        sys.exit(1)
    print(f"Repo OK: {OWNER}/{REPO}")

    # Check default branch
    if info.get("default_branch"):
        branch = info["default_branch"]
        print(f"Default branch: {branch}")

    # Get current tree to find existing SHA
    def get_file_sha(path):
        status, data = gh(f"/contents/{path}?ref={branch}")
        if status == 200:
            return data.get("sha")
        return None

    # Walk project directory
    project_dir = os.path.dirname(os.path.abspath(__file__))
    skip_dirs = {".git", "node_modules", "dist", "__pycache__"}
    skip_files = {"blog.db", "blog.db-shm", "blog.db-wal", "$null"}

    files = []
    for root, dirs, fnames in os.walk(project_dir):
        dirs[:] = [d for d in dirs if d not in skip_dirs]
        for f in fnames:
            if f in skip_files:
                continue
            full = os.path.join(root, f)
            rel = os.path.relpath(full, project_dir).replace("\\", "/")
            files.append((rel, full))

    print(f"Found {len(files)} files to push")

    pushed = 0
    failed = 0
    for rel, full in sorted(files):
        # Read file
        with open(full, "rb") as fh:
            content = fh.read()
        import base64
        b64 = base64.b64encode(content).decode()

        # Check if file exists
        sha = get_file_sha(rel)
        if sha:
            method = "PUT"
            payload = {"message": f"update {rel}", "content": b64, "sha": sha}
        else:
            method = "PUT"
            payload = {"message": f"add {rel}", "content": b64}

        status, data = gh(f"/contents/{rel}?ref={branch}", method, payload)
        # GitHub Contents API: PUT returns 200 (update) or 201 (create)
        # Sometimes urllib wraps it as HTTPError with code 200
        if status in (200, 201) or (isinstance(data, dict) and data.get("content", {}).get("sha")):
            pushed += 1
            print(f"  [OK] {rel}")
        else:
            failed += 1
            err = data.get("message", str(data)) if isinstance(data, dict) else str(data)
            print(f"  [FAIL] {rel}: {err}")

        time.sleep(0.3)

    print(f"\nDone: {pushed} pushed, {failed} failed")
    if pushed > 0:
        print(f"View: https://github.com/{OWNER}/{REPO}")

if __name__ == "__main__":
    main()
