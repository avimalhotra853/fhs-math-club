#!/usr/bin/env python3
"""Fetch extra NuminaMath-CoT source subsets into data/raw/{name}_*.{page}.json.

Usage: python3 scripts/fetch_sources.py [source:max_pages ...]
Defaults to aops_forum (full) and olympiads (first 20k rows).
"""
import json
import os
import sys
import time
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE = "https://datasets-server.huggingface.co"
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "raw")
PAGE_SIZE = 100
JOBS = sys.argv[1:] or ["aops_forum:0", "olympiads:200"]  # 0 = fetch all


def get_json(params, tries=5):
    url = f"{BASE}/filter?{urllib.parse.urlencode(params)}"
    delays = [3, 8, 15, 25]
    for a in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.loads(r.read().decode())
        except Exception:
            if a == tries - 1:
                raise
            time.sleep(delays[min(a, len(delays) - 1)])


def fetch_source(source, max_pages):
    f = get_json({"dataset": "AI-MO/NuminaMath-CoT", "config": "default", "split": "train",
                  "where": f"\"source\"='{source}'", "offset": 0, "length": 1})
    total = f.get("num_rows_total")
    n_pages = (total + PAGE_SIZE - 1) // PAGE_SIZE
    if max_pages:
        n_pages = min(n_pages, max_pages)
    print(f"[{source}] total={total} fetching {n_pages} pages", flush=True)

    def one_page(pi):
        path = os.path.join(OUT, f"{source}.{pi:04d}.json")
        if os.path.exists(path):
            return pi, "cached"
        d = get_json({"dataset": "AI-MO/NuminaMath-CoT", "config": "default", "split": "train",
                      "where": f"\"source\"='{source}'", "offset": pi * PAGE_SIZE,
                      "length": PAGE_SIZE})
        if "rows" not in d:
            raise RuntimeError(f"no rows page {pi}")
        with open(path, "w") as fh:
            json.dump(d["rows"], fh)
        return pi, "ok"

    done = 0
    with ThreadPoolExecutor(max_workers=8) as ex:
        futs = {ex.submit(one_page, pi): pi for pi in range(n_pages)}
        for fut in as_completed(futs):
            fut.result()
            done += 1
            if done % 25 == 0 or done == n_pages:
                print(f"[{source}] {done}/{n_pages}", flush=True)
    print(f"[{source}] DONE", flush=True)


for job in JOBS:
    name, _, cap = job.partition(":")
    fetch_source(name, int(cap or 0))
print("ALL DONE")
