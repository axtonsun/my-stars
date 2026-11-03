#!/usr/bin/env python3
"""Fetch a user's starred repos from the GitHub API and write data/stars.json.

Env:
  STARS_USER    GitHub login whose stars to fetch (required)
  GITHUB_TOKEN  optional, raises the API rate limit

When running inside GitHub Actions it also writes `list_changed=true|false`
to $GITHUB_OUTPUT, so the workflow only commits when stars were added or removed
(not every time a star count ticks up).
"""
import datetime
import json
import os
import re
import sys
import urllib.request

OUT = os.path.join(os.path.dirname(__file__), "..", "data", "stars.json")


def fetch(url, token):
    headers = {
        # star+json adds `starred_at` to every item
        "Accept": "application/vnd.github.star+json",
        "User-Agent": "my-stars-sync",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp), resp.headers.get("Link", "")


def next_url(link_header):
    m = re.search(r'<([^>]+)>;\s*rel="next"', link_header or "")
    return m.group(1) if m else None


def slim(item):
    r = item["repo"]
    return {
        "full_name": r["full_name"],
        "name": r["name"],
        "owner": r["owner"]["login"],
        "url": r["html_url"],
        "description": r.get("description") or "",
        "homepage": r.get("homepage") or "",
        "language": r.get("language") or "",
        "topics": r.get("topics") or [],
        "stars": r.get("stargazers_count", 0),
        "forks": r.get("forks_count", 0),
        "archived": bool(r.get("archived")),
        "is_fork": bool(r.get("fork")),
        "license": (r.get("license") or {}).get("spdx_id") or "",
        "created_at": r.get("created_at"),
        "pushed_at": r.get("pushed_at"),
        "starred_at": item.get("starred_at"),
    }


def main():
    user = os.environ.get("STARS_USER") or (sys.argv[1] if len(sys.argv) > 1 else "")
    if not user:
        sys.exit("STARS_USER is not set")
    token = os.environ.get("GITHUB_TOKEN")

    repos = []
    url = f"https://api.github.com/users/{user}/starred?per_page=100"
    while url:
        page, link = fetch(url, token)
        repos.extend(slim(i) for i in page)
        url = next_url(link)
    repos.sort(key=lambda r: r["starred_at"] or "", reverse=True)

    old_names = set()
    if os.path.exists(OUT):
        with open(OUT, encoding="utf-8") as f:
            old_names = {r["full_name"] for r in json.load(f).get("repos", [])}
    new_names = {r["full_name"] for r in repos}
    changed = old_names != new_names

    data = {
        "user": user,
        "synced_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "repos": repos,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write("\n")

    added = len(new_names - old_names)
    removed = len(old_names - new_names)
    print(f"{len(repos)} starred repos ({added} added, {removed} removed)")
    gh_out = os.environ.get("GITHUB_OUTPUT")
    if gh_out:
        with open(gh_out, "a") as f:
            f.write(f"list_changed={'true' if changed else 'false'}\n")


if __name__ == "__main__":
    main()
