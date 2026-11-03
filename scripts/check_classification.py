#!/usr/bin/env python3
"""Compare data/stars.json with data/classification.json.

Prints starred repos that have no category yet (they show up under
「待归档」on the site), entries for repos that are no longer starred,
any entry pointing at an unknown category, and English text that is missing
(category name_en / desc_en, repo summary_en, or a Chinese tag with no
translation in tags_en), and tags that only repeat the language GitHub
reports for the repo (the card already shows that language).
Exits 1 if something needs fixing.
"""
import json
import os
import re
import sys

CJK = re.compile(r"[\u3000-\u9fff\uff00-\uffef]")

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

    tags_en = cls.get("tags_en", {})
    used_tags = {t for n, e in entries.items() if n in starred for t in e.get("tags", [])}
    no_en = [f"category {c}" for c, m in cats.items() if not m.get("name_en") or not m.get("desc_en")]
    no_en += [f"{n}  summary_en" for n, e in entries.items() if n in starred and not e.get("summary_en")]
    no_en += [f"tag 「{t}」 (add it to tags_en)" for t in sorted(used_tags) if CJK.search(t) and t not in tags_en]
    unused_en = [t for t in tags_en if t not in used_tags]
    lang_tags = [(n, t) for n, e in entries.items() if n in starred and starred[n].get("language")
                 for t in e.get("tags", []) if t.casefold() == starred[n]["language"].casefold()]

    print(f"starred: {len(stars)}  classified: {len(entries) - len(stale)}  categories: {len(cats)}")
    for r in missing:
        print(f"  UNCLASSIFIED  {r['full_name']}  [{r['language'] or '-'}]  {r['description'][:100]}")
    for n in stale:
        print(f"  NOT STARRED   {n}")
    for n in bad_cat:
        print(f"  BAD CATEGORY  {n} -> {entries[n].get('cat')}")
    for c in ungrouped:
        print(f"  NO GROUP      {c}")
    for x in no_en:
        print(f"  NO ENGLISH    {x}")
    for t in unused_en:
        print(f"  UNUSED TAG    {t}  (no starred repo uses it; delete it from tags_en)")
    for n, t in lang_tags:
        print(f"  LANGUAGE TAG  {n}  「{t}」 (GitHub already says it is written in {t}; delete the tag)")

    counts = {}
    for n, e in entries.items():
        if n in starred:
            counts[e["cat"]] = counts.get(e["cat"], 0) + 1
    for c, meta in cats.items():
        print(f"  {counts.get(c, 0):>3}  {meta['glyph']} {meta['name']} / {meta.get('name_en', '?')}")

    sys.exit(1 if (missing or stale or bad_cat or ungrouped or no_en or unused_en or lang_tags) else 0)


if __name__ == "__main__":
    main()
