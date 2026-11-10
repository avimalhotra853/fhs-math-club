#!/usr/bin/env python3
"""Split site/assets/data/algolia_records.json into upload-ready parts.

Algolia's dashboard "Upload a File" accepts JSON arrays up to ~10 MB per file,
so the full record dump is split into algolia_part_00.json, algolia_part_01.json,
... inside site/assets/data/algolia_upload/. Upload each part in order.
"""
import json
import os

ROOT = os.path.join(os.path.dirname(__file__), "..")
DATA = os.path.join(ROOT, "site", "assets", "data")
SRC = os.path.join(DATA, "algolia_records.json")
OUT_DIR = os.path.join(DATA, "algolia_upload")
MAX_BYTES = 9 * 1024 * 1024  # stay safely under the dashboard limit

records = json.load(open(SRC))
os.makedirs(OUT_DIR, exist_ok=True)

parts = []
current = []
size = 2  # opening bracket
for rec in records:
    blob = json.dumps(rec, separators=(",", ":"))
    add = len(blob) + (1 if current else 0)
    if current and size + add > MAX_BYTES:
        parts.append(current)
        current = []
        size = 2
    current.append(rec)
    size += add
if current:
    parts.append(current)

for i, part in enumerate(parts):
    path = os.path.join(OUT_DIR, f"algolia_part_{i:02d}.json")
    with open(path, "w") as f:
        json.dump(part, f, separators=(",", ":"))
    print(f"{os.path.basename(path)}: {len(part)} records, {os.path.getsize(path) // 1024} KB")

print(f"Total: {len(records)} records in {len(parts)} files -> {OUT_DIR}")
