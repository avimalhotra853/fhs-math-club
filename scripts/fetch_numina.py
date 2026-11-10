#!/usr/bin/env python3
"""Fetch the amc_aime subset of AI-MO/NuminaMath-CoT into data/raw/numina_amc.*.json.

Resumable: skips pages whose files already exist on disk.
"""
import json
import os
import time
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE = "https://datasets-server.huggingface.co"
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "raw")
WHERE = "\"source\"='amc_aime'"
PAGE_SIZE = 100


def get_json(path, params, tries=5):
    url = f"{BASE}{path}?{urllib.parse.urlencode(params)}"
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


def main():
    os.makedirs(OUT, exist_ok=True)
    f = get_json("/filter", {"dataset": "AI-MO/NuminaMath-CoT", "config": "default",
                             "split": "train", "where": WHERE, "offset": 0, "length": 1})
    total = f.get("num_rows_total")
    print("total rows:", total)

    n_pages = (total + PAGE_SIZE - 1) // PAGE_SIZE
    params = {"dataset": "AI-MO/NuminaMath-CoT", "config": "default",
              "split": "train", "where": WHERE}

    def one_page(pi):
        path = os.path.join(OUT, f"numina_amc.{pi:04d}.json")
        if os.path.exists(path):
            return pi, "cached"
        p = dict(params)
        p["offset"] = pi * PAGE_SIZE
        p["length"] = PAGE_SIZE
        d = get_json("/filter", p)
        if "rows" not in d:
            raise RuntimeError(f"no rows in page {pi}: {str(d)[:150]}")
        with open(path, "w") as fh:
            json.dump(d["rows"], fh)
        return pi, "fetched"

    done = 0
    with ThreadPoolExecutor(max_workers=6) as ex:
        futs = {ex.submit(one_page, pi): pi for pi in range(n_pages)}
        for fut in as_completed(futs):
            pi, status = fut.result()
            done += 1
            if done % 10 == 0 or done == n_pages:
                print(f"{done}/{n_pages} pages ({status} last)", flush=True)
    print("DONE")


if __name__ == "__main__":
    main()
