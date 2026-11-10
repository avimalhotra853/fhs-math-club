#!/usr/bin/env python3
"""Delete every record from the Algolia `problems` index (keeps settings)."""
import asyncio
import os
import sys

from algoliasearch.search.client import SearchClient

APP_ID = os.environ.get("APP_ID")
ADMIN_KEY = os.environ.get("ALGOLIA_ADMIN_KEY")
if not APP_ID or not ADMIN_KEY:
    sys.exit("Set APP_ID and ALGOLIA_ADMIN_KEY environment variables")


async def main():
    client = SearchClient(APP_ID, ADMIN_KEY)
    res = await client.clear_objects(index_name="problems")
    await client.wait_for_task(index_name="problems", task_id=res.task_id)
    check = await client.search_single_index(
        index_name="problems", search_params={"query": "", "hitsPerPage": 0})
    print("Records remaining:", check.nb_hits)


asyncio.run(main())
