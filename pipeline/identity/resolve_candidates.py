#!/usr/bin/env python3
"""
Candidate identity resolution (P2).

A surface mention of a candidate, as the extractor emitted it, becomes one of:

    resolved       a canonical candidate identity, with a stable candidate_id
    generic        a class-level mention ("AAVs", "AAV vector") — not a candidate
    unresolved     the text names something it has not identified ("novel AAV9")
    non_candidate  a known entity that is not an AAV capsid candidate ("AAVR")

Only `resolved` mentions become candidate profiles. The other three are kept
and reported, never dropped and never guessed into a neighbour
(scientific principle: identity is canonicalized before aggregation).

What this module deliberately does NOT do:

- infer a parent or any lineage (a comparator is not a parent);
- merge pseudotypes into either parent (AAV2/5 is not AAV2 and not AAV5);
- strip cargo or mutation suffixes (AAV2-R432A is a mutant, AAV8-FVIII is
  cargo, AAV9-NVVRSSS is a peptide insertion; the surface form cannot tell
  them apart, so each keeps its own identity);
- produce any score, rank, confidence or biological claim.

Normalization is typography only. Anything needing a naming judgement goes in
`alias_registry.json`, where it carries a written reason.
"""

import json
import re
import unicodedata
from pathlib import Path

REGISTRY_PATH = Path(__file__).resolve().parent / "alias_registry.json"

RESOLVED = "resolved"
GENERIC = "generic"
UNRESOLVED = "unresolved"
NON_CANDIDATE = "non_candidate"

# Leading "r" (recombinant) or "sc" (self-complementary) before an explicit
# serotype number. Approved for the MVP: both describe the genome, not the
# capsid, so rAAV2 and scAAV2 are the AAV2 capsid. The surface mention is
# preserved in the evidence record. Genome configuration is not modelled yet.
_PREFIX = re.compile(r"^(sc|r)?\s*aav(.*)$", re.IGNORECASE)

# "AAV-9" / "AAV 9" -> "AAV9"; "AAV rh.10" -> "AAVrh.10".
_JOIN = re.compile(r"^[\s\-]+(?=\d|rh)", re.IGNORECASE)

_DASHES = dict.fromkeys(map(ord, "‐‑‒–—―−"), "-")


class RegistryError(Exception):
    """The alias registry is malformed or self-contradictory."""


def load_registry(path=None):
    """Read the registry and index it for lookup. Raises on contradictions."""

    with open(path or REGISTRY_PATH, "r", encoding="utf-8") as handle:
        raw = json.load(handle)

    generic = {term.casefold() for term in raw["generic_terms"]["terms"]}
    markers = {term.casefold() for term in raw["unresolved_markers"]["markers"]}

    non_candidates = {}
    for entry in raw["non_candidate_terms"]["terms"]:
        non_candidates[match_key(entry["term"])] = entry["reason"]

    alias_to_canonical = {}
    for entry in raw["aliases"]:
        canonical = entry["canonical_name"]
        forms = [canonical] + list(entry["aliases"])
        for form in forms:
            key = match_key(form)
            previous = alias_to_canonical.get(key)
            if previous is not None and previous != canonical:
                raise RegistryError(
                    f"{form!r} maps to both {previous!r} and {canonical!r}"
                )
            alias_to_canonical[key] = canonical

    overlap = sorted(set(alias_to_canonical) & set(non_candidates))
    if overlap:
        raise RegistryError(f"terms are both alias and non-candidate: {overlap}")

    return {
        "generic_terms": generic,
        "unresolved_markers": markers,
        "non_candidate_terms": non_candidates,
        "alias_to_canonical": alias_to_canonical,
    }


def clean(surface):
    """NFKC, unify dash characters, collapse whitespace, strip."""

    text = unicodedata.normalize("NFKC", surface or "")
    text = text.translate(_DASHES)
    return re.sub(r"\s+", " ", text).strip()


def canonical_form(surface):
    """Typography-only canonical spelling. No biological judgement."""

    text = clean(surface)
    if not text:
        return ""

    match = _PREFIX.match(text)
    if not match:
        return text

    prefix = (match.group(1) or "").lower()
    rest = _JOIN.sub("", match.group(2))
    core = "AAV" + rest

    # Drop r/sc only when the serotype is explicit (approved MVP decision).
    if prefix and re.match(r"^\d", rest):
        return core

    if prefix:
        return prefix + core

    return core


def match_key(surface):
    """Lookup key: canonical form, case-folded."""

    return canonical_form(surface).casefold()


def candidate_id(canonical_name):
    """
    Stable slug of the canonical name. Depends on nothing else — not on PMID,
    not on input order, not on corpus contents — so ids survive a rebuild.

    "/" maps to "_" while every other separator maps to "-", because the two
    carry different meanings: AAV2/5 is a pseudotype (AAV2 genome, AAV5
    capsid) and AAV2.5 is a chimeric capsid. Collapsing both to "aav2-5" would
    merge two distinct candidates.
    """

    slug = canonical_name.casefold().replace("/", "_")
    slug = re.sub(r"[^a-z0-9_]+", "-", slug).strip("-_")
    if not slug:
        raise ValueError(f"canonical name produces an empty id: {canonical_name!r}")
    return slug


def has_unresolved_marker(surface, markers):
    tokens = re.findall(r"[a-z]+", clean(surface).casefold())
    return any(token in markers for token in tokens)


def resolve(surface, registry):
    """
    Classify one surface mention. Returns a dict with `identity_status` and,
    when resolved, `canonical_name` + `candidate_id`. `rule` records which
    step decided, so every profile can state why it exists.
    """

    text = clean(surface)

    if not text:
        return {
            "surface": surface,
            "identity_status": UNRESOLVED,
            "rule": "empty_mention",
            "canonical_name": None,
            "candidate_id": None,
        }

    key = match_key(text)

    if key in registry["generic_terms"]:
        return {
            "surface": text,
            "identity_status": GENERIC,
            "rule": "generic_term",
            "canonical_name": None,
            "candidate_id": None,
        }

    if has_unresolved_marker(text, registry["unresolved_markers"]):
        return {
            "surface": text,
            "identity_status": UNRESOLVED,
            "rule": "unresolved_marker",
            "canonical_name": None,
            "candidate_id": None,
        }

    reason = registry["non_candidate_terms"].get(key)
    if reason is not None:
        return {
            "surface": text,
            "identity_status": NON_CANDIDATE,
            "rule": "non_candidate_term",
            "reason": reason,
            "canonical_name": None,
            "candidate_id": None,
        }

    canonical = registry["alias_to_canonical"].get(key)
    if canonical is not None:
        return {
            "surface": text,
            "identity_status": RESOLVED,
            "rule": "registry_alias",
            "canonical_name": canonical,
            "candidate_id": candidate_id(canonical),
        }

    canonical = canonical_form(text)
    rule = "normalized" if canonical != text else "self_canonical"

    return {
        "surface": text,
        "identity_status": RESOLVED,
        "rule": rule,
        "canonical_name": canonical,
        "candidate_id": candidate_id(canonical),
    }
