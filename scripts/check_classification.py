#!/usr/bin/env python3
"""Compare data/stars.json with data/classification.json.

Prints starred repos that have no category yet (they show up under
「新收藏 · 待分类」on the site), entries for repos that are no longer starred,
and any entry pointing at an unknown category. Exits 1 if something needs fixing.
"""
import json
import os
import sys

DATA = os.path.join(os.path.dirname(__file__), "..", "data")


def load(name):
    with open(os.path.join(DATA, name), encoding="utf-8") as f:
        return json.load(f)


def main():
    stars = load("stars.json")["repos"]
    cls = load("classification.json")
    cats = cls["categories"]
    entries = cls["repos"]

    starred = {r["full_name"]: r for r in stars}
    missing = [r for r in stars if r["full_name"] not in entries]
    stale = [name for name in entries if name not in starred]
    bad_cat = [n for n, e in entries.items() if e.get("cat") not in cats]
    grouped = {c for g in cls["groups"] for c in g["cats"]}
    ungrouped = [c for c in cats if c not in grouped]

    print(f"starred: {len(stars)}  classified: {len(entries) - len(stale)}  categories: {len(cats)}")
    for r in missing:
        print(f"  UNCLASSIFIED  {r['full_name']}  [{r['language'] or '-'}]  {r['description'][:100]}")
    for n in stale:
        print(f"  NOT STARRED   {n}")
    for n in bad_cat:
        print(f"  BAD CATEGORY  {n} -> {entries[n].get('cat')}")
    for c in ungrouped:
        print(f"  NO GROUP      {c}")

    counts = {}
    for n, e in entries.items():
        if n in starred:
            counts[e["cat"]] = counts.get(e["cat"], 0) + 1
    for c, meta in cats.items():
        print(f"  {counts.get(c, 0):>3}  {meta['glyph']} {meta['name']}")

    sys.exit(1 if (missing or stale or bad_cat or ungrouped) else 0)


if __name__ == "__main__":
    main()
