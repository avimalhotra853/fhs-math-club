# FHS Math Club

A website for the Fremont High School math club, a club which teaches students about competition math and problem solving. 

**Meetings: Thursday lunch, Mr. Epperson’s room, Room 93.**

**Website:** https://avimalhotra853.github.io/fhs-math-club/

**Repository:** https://github.com/avimalhotra853/fhs-math-club

## Run the website

From this project folder:

```bash
python3 -m http.server 8000 --directory site
```

Open **http://localhost:8000**. Stop the server with **Ctrl+C**.


Sources:

- [AIME 1983–2024](https://huggingface.co/datasets/di-zhang-fdu/AIME_1983_2024): exam metadata and answers.
- [NuminaMath-CoT](https://huggingface.co/datasets/AI-MO/NuminaMath-CoT): AMC/AIME, olympiad, AoPS community, and school practice subsets.
- [MATH](https://huggingface.co/datasets/EleutherAI/hendrycks_math): existing training imports plus held-out test problems across seven subjects.
- [OlympiadBench](https://huggingface.co/datasets/Hothan/OlympiadBench): English text-only competition mathematics; supplied answers/solutions retained.

BMT and SMT imports use only official paired papers, preserve original math/diagram artwork, and include per-problem links to source PDF pages. These problems are explicitly unrated; no difficulty scores or solutions are invented. Extracted PDF text is used for search and may have imperfect mathematical formatting.

Official full-paper archives are linked directly for [BMT](https://berkeley.mt/archives/) and [SMT](https://sumo.stanford.edu/smt/). The importer currently accepts 176 paired papers. Power rounds with shared proof context and 25 other papers with unverified boundaries/matches are conservatively omitted. Full coverage and skip reasons are recorded in `data/official/import-report.json`.
