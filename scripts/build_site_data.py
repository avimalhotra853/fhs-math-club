#!/usr/bin/env python3
"""Build compact site data from data/raw/ into site/assets/data/.

Source model (what students see in the sidebar):
  AIME      - real AIME exams 1983-2024 (year from dataset, answers only)
  AMC       - real AMC-style problems (contest + year parsed from text when present)
  Olympiad  - olympiad-style problems (NuminaMath olympiads subset)
  Forum     - AoPS community problems
  School    - curriculum problems (NuminaMath cn_k12 + synthetic_math)
  MATH      - MATH dataset, Levels 1-5 (subject from dataset)

Every record: subject (top-level), topic (specific), lvl (difficulty tier).
Topics are assigned per-dataset-subject in a second pass over topic rules so
keywords can never pull a problem out of its dataset subject.
"""
import glob
import json
import os
import re

ROOT = os.path.join(os.path.dirname(__file__), "..")
RAW = os.path.join(ROOT, "data", "raw")
OUT = os.path.join(ROOT, "site", "assets", "data")
CHUNK_SIZE = 250
MAX_SOLUTION_CHARS = 6000

MATH_SUBJECT_MAP = {
    "hendrycks_algebra": "Algebra",
    "hendrycks_counting_and_probability": "Counting & Probability",
    "hendrycks_geometry": "Geometry",
    "hendrycks_intermediate_algebra": "Intermediate Algebra",
    "hendrycks_number_theory": "Number Theory",
    "hendrycks_prealgebra": "Algebra",  # folded into Algebra per site taxonomy
    "hendrycks_precalculus": "Precalculus",
}

# ---------------------------------------------------------------------------
# Contest detection: pull contest + year out of problem text when present.
# ---------------------------------------------------------------------------
CONTEST_PATTERNS = [
    ("AMC 8", re.compile(r"\b(19|20)\d{2}\s*AMC\s*8\b|\bAMC\s*8\b", re.I)),
    ("AMC 10", re.compile(r"\b(19|20)\d{2}\s*AMC\s*10\b|\bAMC\s*10[A-Z]*\b", re.I)),
    ("AMC 12", re.compile(r"\b(19|20)\d{2}\s*AMC\s*12\b|\bAMC\s*12[A-Z]*\b", re.I)),
    ("AMC", re.compile(r"\b(19|20)\d{2}\s*AMC\b|\bAMC\b", re.I)),
    ("AHSME", re.compile(r"\bAHSME\b", re.I)),
    ("AIME", re.compile(r"\bAIME\b", re.I)),
    ("USAMO", re.compile(r"\bUSAMO\b|\bUSA TST\b", re.I)),
    ("USAJMO", re.compile(r"\bUSAJMO\b", re.I)),
    ("IMO", re.compile(r"\bIMO\b|\bInternational Mathematical Olympiad\b", re.I)),
    ("Putnam", re.compile(r"\bPutnam\b", re.I)),
    ("HMMT", re.compile(r"\bHMMT\b|\bHarvard[- ]MIT\b", re.I)),
    ("PUMaC", re.compile(r"\bPUMaC\b|\bPrinceton University Mathematics Competition\b", re.I)),
    ("BMT", re.compile(r"\bBMT\b|\bBerkeley Math Tournament\b", re.I)),
    ("SMT", re.compile(r"\bSMT\b|\bStanford Math Tournament\b", re.I)),
    ("CHMMC", re.compile(r"\bCHMMC\b|\bHarvey Mudd\b", re.I)),
    ("ARML", re.compile(r"\bARML\b", re.I)),
    ("Mandelbrot", re.compile(r"\bMandelbrot\b", re.I)),
    ("CMIMC", re.compile(r"\bCMIMC\b", re.I)),
]
YEAR_RE = re.compile(r"\b((?:19|20)\d{2})\b")


def detect_contest(problem):
    for name, rx in CONTEST_PATTERNS:
        m = rx.search(problem)
        if m:
            ym = YEAR_RE.search(problem[: m.end() + 8])
            year = int(ym.group(1)) if ym else None
            return name, year
    return None, None


# ---------------------------------------------------------------------------
# Topic taxonomy. Rules are grouped by subject; a problem's subject decides
# which rule list applies. First matching rule in that list wins.
# ---------------------------------------------------------------------------
TOPIC_RULES = {
    "Algebra": [
        ("Polynomials", r"polynomial|vieta|coefficient"),
        ("Sequences & Series", r"sequence|progression|\bseries\b|recurrence"),
        ("Logarithms", r"logarithm|\\log|\\ln"),
        ("Functions", r"function|domain|range|inverse"),
        ("Complex Numbers", r"complex number|imaginary|roots of unity"),
        ("Optimization", r"maximum value|minimum value|greatest possible|least possible|maximi|minimi"),
        ("Quadratics", r"quadratic|parabola|discriminant"),
        ("Systems of Equations", r"system of equations|simultaneous"),
        ("Exponents & Radicals", r"exponent|\\sqrt|radical"),
        ("Inequalities", r"inequality|inequalities"),
        ("Absolute Value", r"absolute value"),
        ("Word Problems", r"\bspeed\b|\brate\b|\bprice\b|\bcost\b|percent|\bages?\b|work rate|distance"),
        ("Algebra", r"."),
    ],
    "Intermediate Algebra": [
        ("Polynomials", r"polynomial|vieta|coefficient"),
        ("Sequences & Series", r"sequence|progression|\bseries\b|recurrence"),
        ("Logarithms", r"logarithm|\\log|\\ln"),
        ("Complex Numbers", r"complex number|imaginary|roots of unity"),
        ("Functions", r"function|domain|range|inverse"),
        ("Conics", r"ellipse|hyperbola|asymptote"),
        ("Algebra", r"."),
    ],
    "Counting & Probability": [
        ("Probability", r"probability|randomly|odds|flip|roll|\bdie\b|\bdice\b|\bcoin\b"),
        ("Expected Value", r"expected value|expectation"),
        ("Permutations & Combinations", r"permutation|combination|binomial|how many arrangements"),
        ("Paths & Grids", r"lattice|grid|path"),
        ("Counting Principles", r"how many ways|number of ways|inclusion-exclusion|pigeonhole|\bsets?\b"),
        ("Counting", r"."),
    ],
    "Geometry": [
        ("Circles", r"circle|chord|tangent|inscribed|circumference|incircle|circumcircle|\barc\b"),
        ("3D Geometry", r"tetrahedron|polyhedron|cube|sphere|cylinder|\bcone\b|prism|pyramid|octahedron|dodecahedron|icosahedron"),
        ("Triangles", r"triangle|centroid|orthocenter|incenter|circumcenter|median"),
        ("Quadrilaterals & Polygons", r"polygon|hexagon|pentagon|octagon|quadrilateral|parallelogram|rhombus|trapezoid|rectangle|square"),
        ("Trigonometry", r"law of sines|law of cosines|trigonometr|\\sin|\\cos|\\tan"),
        ("Coordinate Geometry", r"coordinate|slope|line y=|point \(|origin"),
        ("Area & Perimeter", r"area|perimeter"),
        ("Angles", r"angle"),
        ("Similarity", r"similar|proportional"),
        ("Geometry", r"."),
    ],
    "Number Theory": [
        ("Modular Arithmetic", r"modulo|modular|\bmod\b|remainder|congruent"),
        ("Prime Numbers", r"prime"),
        ("GCD & LCM", r"gcd|greatest common divisor|least common multiple|\blcm\b"),
        ("Digits & Bases", r"digit|base|\bbinary\b|hexadecimal"),
        ("Divisibility & Factors", r"divis|factor"),
        ("Powers & Perfect Numbers", r"perfect square|perfect cube|power of"),
        ("Number Theory", r"."),
    ],
    "Precalculus": [
        ("Trigonometric Identities", r"identity|arctan|arcsin|arccos|inverse trig"),
        ("Trigonometric Functions", r"\\sin|\\cos|\\tan|\bcos\b|\bsin\b|\btan\b"),
        ("Vectors & Matrices", r"vector|matrix|determinant|dot product"),
        ("Conic Sections", r"ellipse|hyperbola|parabola|directrix|asymptote"),
        ("Complex Numbers", r"complex|imaginary|de moivre"),
        ("Precalculus", r"."),
    ],
}

SUBJECT_ALIASES = {
    "Intermediate Algebra": "Algebra",
}

# ---------------------------------------------------------------------------
# Difficulty: continuous 1..10 score per problem, derived from source tier,
# MATH level, contest references, and problem length. Bands: 1-3 easy,
# 4-6 medium, 7-8 hard, 9-10 elite. Used for the site's difficulty badge.
# ---------------------------------------------------------------------------
SRC_BASE_SCORE = {"AIME": 7.0, "AMC": 4.5, "Olympiad": 8.5, "Forum": 6.0,
                  "School": 2.5, "MATH": 3.5}

HARD_HINTS = re.compile(
    r"\bUSAMO\b|\bIMO\b|\bPutnam\b|\bUSA TST\b|\bHMMT\b|\bPUMaC\b|\bARML\b|proof", re.I)
EASY_HINTS = re.compile(
    r"\bcompute\b|\bevaluate\b|\bsimplify\b|\bconvert\b|\bhow many\b", re.I)


def band_for(score):
    if score <= 3:
        return "Easy"
    if score <= 6:
        return "Medium"
    if score <= 8:
        return "Hard"
    return "Elite"


def difficulty_score(src, level, problem, contest):
    score = SRC_BASE_SCORE.get(src, 5.0)
    if level and "Lvl" in level:
        try:
            score = float(level.split("Lvl")[1].strip()) + 0.5
        except (ValueError, IndexError):
            pass
    # Contest references shift difficulty.
    if src in ("AIME", "AMC", "Olympiad", "Forum"):
        c = (contest or "")
        if c in ("USAMO", "IMO", "Putnam", "USAJMO"):
            score = max(score, 9.0)
        elif c in ("HMMT", "PUMaC", "BMT", "SMT", "ARML"):
            score = max(score, 8.0)
    # Long statements skew harder; short computational ones skew easier.
    n = len(problem)
    if n > 500:
        score += 0.7
    elif n > 280:
        score += 0.4
    elif n < 90:
        score -= 0.5
    if HARD_HINTS.search(problem[:300]):
        score += 0.8
    if EASY_HINTS.search(problem[:200]):
        score -= 0.4
    return max(1.0, min(10.0, round(score, 1)))

# Difficulty: from explicit level when available, else by source heuristic.
SRC_TIER = {"Olympiad": "Competition", "Forum": "Advanced", "School": "Foundations"}


def tier_for(level, src):
    if level and "Lvl" in level:
        return level.replace("Lvl ", "Level ")
    return SRC_TIER.get(src, "Competition")


RULES_COMPILED = {s: [(t, re.compile(p, re.I)) for t, p in rules] for s, rules in TOPIC_RULES.items()}
DEFAULT_TOPIC = {
    "Algebra": "Algebra", "Intermediate Algebra": "Algebra",
    "Counting & Probability": "Counting",
    "Geometry": "Geometry", "Number Theory": "Number Theory",
    "Precalculus": "Precalculus",
}

# Subject detection for sources that lack subject metadata (AIME/AMC/Olympiad/
# Forum/School). Ordered list of (subject, rule); first hit wins. This decides
# WHICH topic rule list applies, so problems land in a real subject.
SUBJECT_RULES = [
    ("Counting & Probability", re.compile(
        r"probability|randomly|odds|flip|roll|\bdie\b|\bdice\b|\bcoin\b|expected value"
        r"|permutation|combination|how many ways|number of ways|inclusion-exclusion|pigeonhole", re.I)),
    ("Number Theory", re.compile(
        r"modulo|modular|\bmod\b|remainder|congruent|prime|greatest common divisor"
        r"|least common multiple|\blcm\b|\bgcd\b|digit|\bbase\b|binary|hexadecimal|divisor|divis", re.I)),
    ("Geometry", re.compile(
        r"circle|chord|tangent|triangle|angle|polygon|hexagon|pentagon|octagon|quadrilateral"
        r"|parallelogram|rhombus|trapezoid|tetrahedron|polyhedron|cube|sphere|cylinder|\bcone\b"
        r"|prism|pyramid|area|perimeter|radius|diameter|\bsin\b|\bcos\b|\btan\b|\bAB\b|\bCD\b", re.I)),
    ("Precalculus", re.compile(
        r"arctan|arcsin|arccos|trigonometric|vector|matrix|determinant|ellipse|hyperbola"
        r"|complex number|roots of unity|de moivre", re.I)),
    ("Algebra", re.compile(
        r"polynomial|vieta|sequence|progression|\bseries\b|logarithm|function|quadratic"
        r"|parabola|equation|system of equations|inequality|exponent|\bsolve\b|\bsum\b|\bproduct\b", re.I)),
]


def pick_subject(text, fallback):
    """Decide the subject for sources without subject metadata."""
    for subj, rx in SUBJECT_RULES:
        if rx.search(text):
            return subj
    return fallback if fallback in DEFAULT_TOPIC else "Algebra"


def pick_topic(subject, text):
    rules = RULES_COMPILED.get(subject)
    if rules:
        for t, rx in rules:
            if rx.search(text):
                return t
    return DEFAULT_TOPIC.get(subject, "General")


records = []
seen = set()


ID_COUNTERS = {}


def add(problem, solution, src, subject, level, year, contest, answer="", contest_id=""):
    problem = (problem or "").strip()
    solution = (solution or "").strip()
    answer = (answer or "").strip()
    if not problem or len(problem) < 20:
        return
    subject = SUBJECT_ALIASES.get(subject, subject)
    if subject not in TOPIC_RULES:  # AIME/AMC/Olympiad/Forum/School
        subject = pick_subject(problem[:700], subject)
    if solution:
        idx = solution.rfind("\\boxed{")
        if idx != -1:
            depth = 0
            for j in range(idx + 7, len(solution)):
                c = solution[j]
                if c == "{":
                    depth += 1
                elif c == "}":
                    if depth == 0:
                        answer = answer or solution[idx + 7:j]
                        break
                    depth -= 1
    k = re.sub(r"[^a-z0-9]", "", problem.lower())[:150]
    if k in seen:
        return
    seen.add(k)

    # Algolia free plan caps at 50k records; keep total under with headroom
    # by trimming the School bucket (least competition-relevant).
    if src == "School" and ID_COUNTERS.get("School", 0) >= 17900:
        return

    ID_COUNTERS[src] = ID_COUNTERS.get(src, 0) + 1
    _d_score = difficulty_score(src, level, problem, contest)
    if src == "AIME":
        pid = contest_id  # exam id like 1983-1 (passed via contest arg by caller)
    else:
        prefix = {"AMC": "AMC", "Olympiad": "OLY", "Forum": "FUM",
                  "School": "SCH", "MATH": "MTH"}[src]
        pid = f"{prefix}-{ID_COUNTERS[src]}"

    rec = {
        "p": problem[:5000],
        "s": solution[:MAX_SOLUTION_CHARS],
        "a": answer[:80],
        "src": src,
        "subj": subject,
        "topic": pick_topic(subject, problem[:700]),
        "lvl": tier_for(level, src),
        "d": _d_score,
        "band": band_for(_d_score),
        "yr": year,
        "contest": contest or "",
        "id": pid,
    }
    records.append(rec)


def load(prefix):
    rows = []
    for path in sorted(glob.glob(os.path.join(RAW, prefix))):
        with open(path) as f:
            rows.extend(json.load(f))
    return [r.get("row") or {} for r in rows]


# 1. AIME: real exams, dataset provides year
n = 0
for row in load("aime_archive.*.json"):
    if not row.get("Question"):
        continue
    n += 1
    add(row["Question"], "", "AIME", "AIME", None, row.get("Year"), "AIME",
        answer=row.get("Answer"), contest_id=row.get("ID") or f"{row.get('Year')}-{row.get('Problem Number')}")

# 2. AMC: real AMC-style; detect contest + year from text
n = 0
for row in load("numina_amc.*.json"):
    n += 1
    contest, year = detect_contest(row.get("problem", ""))
    add(row.get("problem"), row.get("solution"), "AMC", "AMC", None, year, contest or "AMC")

# 3. Olympiad
n = 0
for row in load("olympiads.*.json"):
    n += 1
    contest, year = detect_contest(row.get("problem", ""))
    add(row.get("problem"), row.get("solution"), "Olympiad", "Olympiad", None, year,
        contest or "Olympiad")

# 4. AoPS Forum
n = 0
for row in load("aops_forum.*.json"):
    n += 1
    contest, year = detect_contest(row.get("problem", ""))
    add(row.get("problem"), row.get("solution"), "Forum", "Forum", None, year,
        contest or "Forum")

# 5. School-level (cn_k12 + synthetic_math)
n = 0
for prefix in ("cn_k12.*.json", "synthetic_math.*.json"):
    for row in load(prefix):
        n += 1
        add(row.get("problem"), row.get("solution"), "School", "School", None, None, "School")

# 6. MATH dataset (levels + dataset subject)
counters = {}
for stem, subject in MATH_SUBJECT_MAP.items():
    for row in load(f"hendrycks_{stem.split('_', 1)[1]}*.json"):
        if not row.get("problem"):
            continue
        counters[subject] = counters.get(subject, 0) + 1
        level = (row.get("level") or "").replace("Level ", "Level ")
        add(row["problem"], row.get("solution"), "MATH", subject, level, None, "MATH dataset")

# IDs: assigned at add() time; AIME keeps its exam id, others use source prefix.
SRC_ORDER = {"AIME": 0, "AMC": 1, "Olympiad": 2, "Forum": 3, "School": 4, "MATH": 5}


SUBJ_ORDER = {"Algebra": 0, "Intermediate Algebra": 1,
              "Counting & Probability": 2, "Geometry": 3, "Number Theory": 4,
              "Precalculus": 5}


def sort_key(x):
    # Subject must be monotonic across the whole file so chunk-level subject
    # bounds (first/last per chunk) are exact for the browser pre-filter.
    subj_rank = SUBJ_ORDER.get(x["subj"], 9)
    if x["src"] == "AIME":
        parts = x["id"].split("-")
        return (0, subj_rank, int(parts[0]) * 10 + (1 if len(parts) > 2 else 0),
                int(parts[-1]))
    return (SRC_ORDER[x["src"]], subj_rank, -(x["yr"] or 0), 0)

records.sort(key=sort_key)

# ---------------------------------------------------------------------------
# Write chunks + metadata
# ---------------------------------------------------------------------------
os.makedirs(OUT, exist_ok=True)
chunks = [records[i:i + CHUNK_SIZE] for i in range(0, len(records), CHUNK_SIZE)]
for ci, chunk in enumerate(chunks):
    with open(os.path.join(OUT, f"chunk_{ci:03d}.json"), "w") as f:
        json.dump(chunk, f, separators=(",", ":"))

# Chunk metadata: source/subject/year bounds for fast pre-filtering
meta = [{
    "file": f"chunk_{ci:03d}.json",
    "n": len(c),
    "src": c[0]["src"],
    "srcEnd": c[-1]["src"],
    "subj": c[0]["subj"],
    "subjEnd": c[-1]["subj"],
    "d": min(x["d"] for x in c),
    "dEnd": max(x["d"] for x in c),
    "band": c[0]["band"],
    "bandEnd": c[-1]["band"],
    "yr": max((x["yr"] or 0) for x in c) or None,
    "yrEnd": min((x["yr"] or 9999) for x in c) if any(x["yr"] for x in c) else None,
} for ci, c in enumerate(chunks)]

# Topic tree: subject -> topic -> count
tree = {}
for rec in records:
    tree.setdefault(rec["subj"], {})
    tree[rec["subj"]][rec["topic"]] = tree[rec["subj"]].get(rec["topic"], 0) + 1
topics_out = [
    {"subject": s, "topics": sorted([{"name": t, "n": n} for t, n in tm.items()],
                                    key=lambda x: -x["n"])}
    for s, tm in sorted(tree.items(), key=lambda kv: -sum(kv[1].values()))
]

src_counts = {}
for rec in records:
    src_counts[rec["src"]] = src_counts.get(rec["src"], 0) + 1
contest_counts = {}
for rec in records:
    if rec["contest"] and rec["contest"] not in ("School", "Olympiad", "Forum", "MATH dataset"):
        contest_counts[rec["contest"]] = contest_counts.get(rec["contest"], 0) + 1

with open(os.path.join(OUT, "all_meta.json"), "w") as f:
    json.dump({"chunks": meta, "total": len(records), "topics": topics_out,
               "subjects": sorted({r["subj"] for r in records}),
               "sources": src_counts,
               "contests": contest_counts}, f, separators=(",", ":"))

print(f"Wrote {len(records)} problems in {len(chunks)} chunks")
for src, n in sorted(src_counts.items(), key=lambda kv: -kv[1]):
    print(f"  {src}: {n}")
print("Contest refs:", dict(sorted(contest_counts.items(), key=lambda kv: -kv[1])[:12]))
print("Topics per subject:", {s: len(t) for s, t in tree.items()})
