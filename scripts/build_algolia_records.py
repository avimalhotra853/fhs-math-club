#!/usr/bin/env python3
"""Generate site/assets/data/algolia_records.json for Algolia upload.

Record shape: { objectID, p, s, a, src, subj, topic, lvl, yr, contest, id }
Problem text is cleaned the same way the site renders it, so search hits
match what students see.
"""
import json
import os

ROOT = os.path.join(os.path.dirname(__file__), "..")
DATA = os.path.join(ROOT, "site", "assets", "data")


def clean(text):
    t = str(text or "")
    t = re.sub(r"\[asy\][\s\S]*?\[/asy\]", "", t, flags=re.I)
    t = re.sub(r"\[([^\]\[]{1,80})\]\([^\)\s]{1,200}\)", r"\1", t)
    t = re.sub(r"https?://[^\s\]]{1,120}", "", t)
    t = t.replace("[", "").replace("]", "")
    t = re.sub(r"\*\*([^*]+)\*\*", r"\1", t)
    return re.sub(r"\s{3,}", "  ", t).strip()


import re  # noqa: E402  (used by clean)

meta = json.load(open(os.path.join(DATA, "all_meta.json")))
records = []
for m in meta["chunks"]:
    chunk = json.load(open(os.path.join(DATA, m["file"])))
    for r in chunk:
        records.append({
            "objectID": r["id"],
            "id": r["id"],
            "p": clean(r["p"]),
            "s": clean(r["s"])[:4000],
            "a": r["a"],
            "src": r["src"],
            "subj": r["subj"],
            "topic": r["topic"],
            "lvl": r["lvl"],
            # Difficulty filters via _tags (exact at any scale); the numeric
            # filter engine mis-counts ranges on large float attributes.
            "d": int(round(float(r["d"]))),
            "band": r["band"],
            "_tags": [r["band"]],
            "yr": r["yr"],
            "contest": r["contest"],
        })

out = os.path.join(DATA, "algolia_records.json")
with open(out, "w") as f:
    json.dump(records, f, separators=(",", ":"))
print(f"Wrote {len(records)} records to {out} ({os.path.getsize(out) // 1024} KB)")
