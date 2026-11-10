#!/usr/bin/env python3
"""Push all problem records to the Algolia `problems` index.

Usage: APP_ID=id ALGOLIA_ADMIN_KEY=key .venv/bin/python scripts/index_algolia.py

algoliasearch v4 methods are coroutines, so everything runs under asyncio.
Also configures searchable attributes and facets for the site's filters.
"""
import asyncio
import json
import os
import sys

try:
    from algoliasearch.search.client import SearchClient
    from algoliasearch.search.models.index_settings import IndexSettings
except ImportError:
    sys.exit("pip install algoliasearch first (see .venv)")

APP_ID = os.environ.get("APP_ID")
ADMIN_KEY = os.environ.get("ALGOLIA_ADMIN_KEY")
if not APP_ID or not ADMIN_KEY:
    sys.exit("Set APP_ID and ALGOLIA_ADMIN_KEY environment variables")

DATA = os.path.join(os.path.dirname(__file__), "..", "site", "assets", "data")
BATCH = 1000
INDEX = "problems"


async def main():
    client = SearchClient(APP_ID, ADMIN_KEY)

    records = json.load(open(os.path.join(DATA, "algolia_records.json")))
    print(f"Pushing {len(records)} records to index '{INDEX}' in batches of {BATCH}")

    last_task = None
    for i in range(0, len(records), BATCH):
        batch = records[i:i + BATCH]
        res = await client.save_objects(index_name=INDEX, objects=batch)
        task_ids = getattr(res, "task_ids", None) or [getattr(res, "task_id", None)]
        last_task = next((t for t in task_ids if t is not None), last_task)
        print(f"  {min(i + BATCH, len(records))}/{len(records)}")

    if last_task is not None:
        try:
            await client.wait_for_task(index_name=INDEX, task_id=last_task)
            print("All batches indexed (final task confirmed).")
        except Exception as e:
            print(f"(Could not block on final task: {str(e)[:100]})")

    res = await client.set_settings(
        index_name=INDEX,
        index_settings=IndexSettings(
            searchable_attributes=["p", "a", "contest", "topic", "subj"],
            attributes_for_faceting=[
                "filterOnly(src)", "filterOnly(subj)", "filterOnly(topic)",
                "filterOnly(lvl)", "filterOnly(yr)", "band",
            ],
            custom_ranking=["desc(yr)"],
        ),
    )
    try:
        await client.wait_for_task(index_name=INDEX, task_id=res.task_id)
    except Exception:
        pass
    print("Index settings applied. Done.")


asyncio.run(main())
