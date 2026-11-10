# FHS Math Club

A completely rebuilt static website for Fremont High School Math Club, with an animated mathematical landing page, a searchable problem library, and information about AMC 10/12, BMT, and SMT.

**Meetings: Thursday lunch, Mr. Epperson’s room, Room 93.**

**Website:** https://avimalhotra853.github.io/fhs-math-club/

**Repository:** https://github.com/avimalhotra853/fhs-math-club

## Run the website

From this project folder:

```bash
python3 -m http.server 8000 --directory site
```

Open **http://localhost:8000**. Stop the server with **Ctrl+C**.

No installation, API key, account, or build step is needed. Opening the HTML file directly will not load the problem library: use the server above. If port 8000 is occupied, choose 8001 instead.

Fonts and mathematical typesetting load independently from Google Fonts and jsDelivr, so a slow external service does not delay the problem library; the layout and problem bank work without them, with local fallback fonts and readable source LaTeX. Problem content and search are served from this folder, without an external search service.

## Features

- Modern white and crimson design with bold typography, the original rotating wireframe torus and responsive card layouts.
- Animated, mathematically projected 3D geometry with pointer interaction; respects reduced-motion preferences and pauses drawing offscreen or in background tabs.
- Full-statement text search in a background worker, across every indexed collection.
- Connected competition, round, year, subject, topic, collection, and difficulty filters; changing a filter clears older incompatible selections, while unavailable metadata is disabled. Filter settings and pagination are preserved in the URL; pagination and sorting.
- Problem dialogs with supplied solutions/answers, math typesetting, shareable `?id=` links, saved problems, and solved progress.
- Random unsolved problem selection that respects active filters.
- Focus timer with 5-, 15-, 25-, and 75-minute presets, custom 1–180-minute durations, pause/resume, and reset.
- Custom timed sets of 3–25 problems from the current search and filters, sampled without duplicates, with optional exclusion of previously solved problems.
- Session pause/resume, automatic pause on tab switching by default, and recovery after refresh. Closing a problem pauses its session.
- Per-problem self-assessment, a persistent review queue, and a session summary showing actual time used and answer/solution openings. No automatic correctness scores are inferred.
- The last session and review queue are stored in this browser; the summary can be cleared independently of solved/review progress.
- Private per-problem scratchpad notes that save automatically in this browser.
- Printable practice worksheets with writing space and source attribution; solutions stay hidden.
- Local browser storage for progress; no student accounts or invented activity statistics.
- Competition information linked to the official MAA, Berkeley, and Stanford websites.
- Original page addresses redirect into the new website and preserve problem links.

## Data and accuracy

The library currently indexes **57,177 entries across nine collections**, including 824 BMT problems and 812 SMT problems imported directly from paired official archive papers, plus 4,935 added MATH test problems and 666 added OlympiadBench problems.

The actual indexed total and collection counts are in `site/assets/data/library.json` and displayed dynamically. This replaces the old inflated count, which included stale duplicate chunks. Original records remain on disk; each original ID is indexed once. Added imports are deduplicated by normalized full statement against the existing library. Cross-dataset duplicates may remain.

The library includes competition, community, and school practice material. School practice includes synthetic problems, explicitly disclosed on the website. Dataset origin is not a guarantee that every record is an official contest question. Difficulty and keyword-based topic tags are estimates. Official BMT/SMT archive years and AIME years supplied by the source dataset are included in the year filter; guessed years from other imports are excluded. Some original imports shortened statements/solutions or omitted diagrams. Supplied dataset solutions can be machine-generated or contain mistakes.

Sources:

- [AIME 1983–2024](https://huggingface.co/datasets/di-zhang-fdu/AIME_1983_2024): exam metadata and answers.
- [NuminaMath-CoT](https://huggingface.co/datasets/AI-MO/NuminaMath-CoT): AMC/AIME, olympiad, AoPS community, and school practice subsets.
- [MATH](https://huggingface.co/datasets/EleutherAI/hendrycks_math): existing training imports plus held-out test problems across seven subjects.
- [OlympiadBench](https://huggingface.co/datasets/Hothan/OlympiadBench): English text-only competition mathematics; supplied answers/solutions retained.

BMT and SMT imports use only official paired papers, preserve original math/diagram artwork, and include per-problem links to source PDF pages. These problems are explicitly unrated; no difficulty scores or solutions are invented. Extracted PDF text is used for search and may have imperfect mathematical formatting.

Official full-paper archives are linked directly for [BMT](https://berkeley.mt/archives/) and [SMT](https://sumo.stanford.edu/smt/). The importer currently accepts 176 paired papers. Power rounds with shared proof context and 25 other papers with unverified boundaries/matches are conservatively omitted. Full coverage and skip reasons are recorded in `data/official/import-report.json`.

To refresh the official archives and rebuild the index:

```bash
.venv/bin/python -m pip install -r scripts/official-requirements.txt
.venv/bin/python scripts/fetch_official_archives.py
.venv/bin/python scripts/import_official_archives.py
python3 scripts/prepare_library.py
python3 scripts/check_official_archives.py
node scripts/check_library.cjs
```

The import is already completed; none of those commands are needed just to run the website. Source PDF downloads are cached locally, with SHA-256 hashes retained for provenance. Original problem and solution crops are stored under `site/assets/official/`. No AI-authored or third-party solutions are used for BMT/SMT records.

## Refresh the search index

```bash
python3 scripts/prepare_library.py
```

This uses existing local chunks plus additional imports already downloaded into `data/raw`. The result is deterministic and doesn't require network access. It writes complete statement indexes in shards and lazy-loads full solutions when a problem is opened.

To download the added public datasets again (requires internet), then reindex:

```bash
python3 scripts/fetch_olympiadbench.py
python3 scripts/fetch_math_test.py
python3 scripts/prepare_library.py
```

The older `fetch_problems.py`, `fetch_sources.py`, `fetch_numina.py`, and `build_site_data.py` scripts remain available for the original source pipeline. After running that pipeline, rerun `prepare_library.py`. Algolia is no longer used by the website.

## Deployment

Serve the `site/` folder on any static host. No server-side code or build command is required. The data index is sizable because search covers all statements; compression and HTTP caching are recommended for a public host.


## Publish to GitHub Pages

A deployment workflow is included in `.github/workflows/pages.yml`. It publishes the existing `site/` folder directly; no build step, paid hosting, or API key is required.

1. On GitHub, create an empty repository named `fhs-math-club`. For GitHub Free, choose Public to use GitHub Pages. Leave the initial README, license, and .gitignore options unchecked because the project already contains files.
2. Run the following in Terminal, replacing `YOUR-USERNAME` with the repository owner's GitHub username:

```bash
cd /Users/avachi/FHS_MathClub
git init -b main
git add .
git commit -m "Add FHS Math Club website"
git remote add origin https://github.com/YOUR-USERNAME/fhs-math-club.git
git push -u origin main
```

3. In the repository, open **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**. Do not select a branch folder: this project publishes `site/` through the included workflow.
4. Open **Actions → Deploy website to GitHub Pages → Run workflow**, select `main`, and run it. This also retries deployment if the initial push happened before Pages was enabled.
5. When the workflow succeeds, open the deployment URL displayed in Actions or Settings → Pages. For that repository name, it normally looks like `https://YOUR-USERNAME.github.io/fhs-math-club/`.

For future updates:

```bash
git add .
git commit -m "Update math club website"
git push
```

Pushes to `main` deploy automatically after Pages is enabled. The ignore file excludes local environments, raw source downloads, and retired Algolia exports. The generated problem index, original problem/solution artwork, and all active website files remain included. The online site will be publicly accessible.

Official GitHub guide: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

Practice state regression checks: `node scripts/check_practice.cjs`.
