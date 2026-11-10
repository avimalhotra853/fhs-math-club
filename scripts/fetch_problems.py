#!/usr/bin/env python3
"""Fetch competition math problems from Hugging Face datasets-server (free, keyless).

Downloads into data/raw/:
  - EleutherAI/hendrycks_math  (7 configs, ~7.5k problems, Level 1-5, with solutions)
  - di-zhang-fdu/AIME_1983_2024 (933 real AIME problems with answers)
  - AI-MO/NuminaMath-CoT filtered to source=amc_aime (~6.8k AMC/AIME problems with solutions)
"""
import json
import os
import sys
import time
import urllib.request
import urllib.parse
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE = "https://datasets-server.huggingface.co"
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "raw")
HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}

HENDRYCKS_CONFIGS = [
    "algebra", "counting_and_probability", "geometry",
    "intermediate_algebra", "number_theory", "prealgebra", "precalculus",
]


def get_json(path, params, retries=6):
    qs = urllib.parse.urlencode(params)
    url = f"{BASE}{path}?{qs}"
    delays = [2, 5, 10, 20, 30, 45]
    last_err = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=75) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as e:  # noqa: BLE001
            last_err = e
            if attempt < retries - 1:
                time.sleep(delays[min(attempt, len(delays) - 1)])
    raise RuntimeError(f"failed after {retries} tries: {url} ({last_err})")


def fetch_pages(task_name, path, params_template, total, page_size=100):
    """Fetch all pages of a rows/filter query. Returns list of row dicts."""
    os.makedirs(OUT, exist_ok=True)
    n_pages = (total + page_size - 1) // page_size
    marker = os.path.join(OUT, f"{task_name}.done")
    if os.path.exists(marker):
        print(f"[{task_name}] already done, skipping")
        return []
    print(f"[{task_name}] fetching {total} rows in {n_pages} pages")

    def one_page(pi):
        offset = pi * page_size
        params = dict(params_template)
        params["offset"] = offset
        params["length"] = page_size
        d = get_json(path, params)
        if "rows" not in d:
            raise RuntimeError(f"no rows in page {pi}: {str(d)[:200]}")
        with open(os.path.join(OUT, f"{task_name}.{pi:04d}.json"), "w") as f:
            json.dump(d["rows"], f)
        return pi

    done = 0
    with ThreadPoolExecutor(max_workers=6) as ex:
        futs = {ex.submit(one_page, pi): pi for pi in range(n_pages)}
        for fut in as_completed(futs):
            pi = fut.result()
            done += 1
            if done % 20 == 0 or done == n_pages:
                print(f"[{task_name}] {done}/{n_pages} pages", flush=True)
    with open(marker, "w") as f:
        f.write("ok")
    return []


def main():
    os.makedirs(OUT, exist_ok=True)

    # 1. hendrycks_math: 7 configs
    for cfg in HENDRYCKS_CONFIGS:
        info = get_json("/info", {"dataset": "EleutherAI/hendrycks_math"})
        total = info["dataset_info"][cfg]["splits"]["train"]["num_examples"]
        fetch_pages(
            f"hendrycks_{cfg}", "/rows",
            {"dataset": "EleutherAI/hendrycks_math", "config": cfg, "split": "train"},
            total,
        )

    # 2. AIME 1983-2024
    total = 933
    fetch_pages(
        "aime_archive", "/rows",
        {"dataset": "di-zhang-fdu/AIME_1983_2024", "config": "default", "split": "train"},
        total,
    )

    # 3. NuminaMath amc_aime subset (via filter; count discovered dynamically)
    try:
        f = get_json("/filter", {
            "dataset": "AI-MO/NuminaMath-CoT", "config": "default", "split": "train",
            "where": "\"source\"='amc_aime'", "offset": 0, "length": 100,
        })
        total = f.get("num_rows_total")
        print(f"[numina] total amc_aime rows: {total}")
        if total:
            fetch_pages(
                "numina_amc", "/filter",
                {"dataset": "AI-MO/NuminaMath-CoT", "config": "default", "split": "train",
                 "where": "\"source\"='amc_aime'"},
                min(total, 7000),
            )
    except Exception as e:  # noqa: BLE001
        print(f"[numina] SKIPPED ({e}) — continuing without it")

    print("ALL FETCHES DONE")


if __name__ == "__main__":
    main()
