#!/usr/bin/env python3
"""
Identity resolver tests (P2).

Covers the behaviour the design fixed before implementation: obvious
typography variants merge, class mentions stay generic, vague mentions stay
unresolved, and the cases that must NOT merge do not merge.
"""

import sys
from pathlib import Path

EVIDENCE_DIR = Path(__file__).resolve().parents[1]
if str(EVIDENCE_DIR) not in sys.path:
    sys.path.insert(0, str(EVIDENCE_DIR))

from identity.resolve_candidates import (  # noqa: E402
    GENERIC,
    NON_CANDIDATE,
    RESOLVED,
    UNRESOLVED,
    candidate_id,
    canonical_form,
    load_registry,
    resolve,
)


def test_formatting_variants(registry):
    """AAV9 / AAV-9 / AAV 9 / en-dash are one identity."""

    for surface in ("AAV9", "AAV-9", "AAV 9", "aav9", "AAV–9", " AAV9 "):
        decision = resolve(surface, registry)
        assert decision["identity_status"] == RESOLVED, surface
        assert decision["canonical_name"] == "AAV9", (surface, decision)
        assert decision["candidate_id"] == "aav9", (surface, decision)

    assert canonical_form("Aavrh.10") == "AAVrh.10"
    print("PASS — formatting variants resolve to one identity")


def test_recombinant_and_self_complementary(registry):
    """r/sc describe the genome; the capsid identity is the serotype."""

    for surface in ("rAAV2", "scAAV2", "rAAV-2", "RAAV2"):
        decision = resolve(surface, registry)
        assert decision["canonical_name"] == "AAV2", (surface, decision)

    # Pseudotype and suffix survive the prefix strip.
    assert resolve("rAAV2/8", registry)["canonical_name"] == "AAV2/8"
    assert resolve("rAAV2-EGFP", registry)["canonical_name"] == "AAV2-EGFP"

    # Without an explicit serotype there is nothing to attach to.
    assert resolve("rAAV", registry)["identity_status"] == GENERIC
    print("PASS — rAAV/scAAV resolve to the capsid when the serotype is explicit")


def test_registry_aliases(registry):
    """Named variants come from the registry, not from broad normalization."""

    for surface in ("AAVPHP.eB", "PHP.eB", "AAV PHP.eB"):
        decision = resolve(surface, registry)
        assert decision["identity_status"] == RESOLVED, surface
        assert decision["canonical_name"] == "AAV-PHP.eB", (surface, decision)
        assert decision["candidate_id"] == "aav-php-eb", (surface, decision)
        assert decision["rule"] == "registry_alias", (surface, decision)

    assert resolve("AAV2-7m8", registry)["canonical_name"] == "AAV2.7m8"
    assert resolve("AAV2.7m8", registry)["canonical_name"] == "AAV2.7m8"
    assert resolve("AAVrh10", registry)["canonical_name"] == "AAVrh.10"
    assert resolve("AAV3b", registry)["canonical_name"] == "AAV3B"
    print("PASS — registry aliases resolve named variants")


def test_generic_mentions(registry):
    """
    A class is not a candidate. Note the extractor types "AAVs" as
    engineered_capsid, so the resolver must decide this itself.
    """

    for surface in ("AAVs", "AAV vector", "AAV vectors", "AAV", "aav capsids"):
        decision = resolve(surface, registry)
        assert decision["identity_status"] == GENERIC, (surface, decision)
        assert decision["candidate_id"] is None, (surface, decision)

    print("PASS — class-level mentions stay generic and get no profile")


def test_unresolved_mentions(registry):
    """A qualified mention names something the text has not identified."""

    for surface in (
        "novel AAV variant(s)",
        "novel AAV9",
        "Novel AAV44",
        "selected variant",
        "our capsid",
        "this AAV8",
    ):
        decision = resolve(surface, registry)
        assert decision["identity_status"] == UNRESOLVED, (surface, decision)
        assert decision["candidate_id"] is None, (surface, decision)

    assert resolve("", registry)["identity_status"] == UNRESOLVED
    assert resolve(None, registry)["identity_status"] == UNRESOLVED
    print("PASS — vague mentions stay unresolved, never attached to a neighbour")


def test_non_candidates(registry):
    """Known non-vector entities are excluded on biological meaning."""

    for surface in ("AAVR", "AAVP", "AAVLP", "AAVX"):
        decision = resolve(surface, registry)
        assert decision["identity_status"] == NON_CANDIDATE, (surface, decision)
        assert decision["reason"], decision

    # Exact match only: a longer string is a different entity.
    assert resolve("AAVR-binding AAV2", registry)["identity_status"] != NON_CANDIDATE
    print("PASS — non-candidate entities are excluded with a stated reason")


def test_no_unsafe_merging(registry):
    """The merges that would be biological claims do not happen."""

    def cid(surface):
        return resolve(surface, registry)["candidate_id"]

    # Pseudotypes: genome and capsid differ.
    assert cid("AAV2/5") not in (cid("AAV2"), cid("AAV5"))
    assert cid("AAV2/8") != cid("AAV8")

    # Point mutant, cargo and peptide insertion each keep their own identity.
    assert cid("AAV2-R432A") != cid("AAV2")
    assert cid("AAV8-FVIII") != cid("AAV8")
    assert cid("AAV9-NVVRSSS") != cid("AAV9")

    # Distinct serotypes never collapse.
    assert len({cid(f"AAV{n}") for n in range(1, 10)}) == 9

    # No parent/lineage field is produced anywhere.
    decision = resolve("AAV9-NVVRSSS", registry)
    assert not any("parent" in key for key in decision), decision
    print("PASS — pseudotypes, mutants and cargo variants are not merged")


def test_id_stability(registry):
    """candidate_id depends on the canonical name alone."""

    assert candidate_id("AAV9") == "aav9"
    assert candidate_id("AAV-PHP.eB") == "aav-php-eb"
    # A pseudotype and a chimera must not share an id.
    assert candidate_id("AAV2/5") == "aav2_5"
    assert candidate_id("AAV2.5") == "aav2-5"
    assert candidate_id("AAV2/5") != candidate_id("AAV2.5")

    # Independent of surface spelling, and of how often it was seen.
    assert resolve("AAV 9", registry)["candidate_id"] == candidate_id("AAV9")

    # Two different canonical names never share an id.
    assert candidate_id("AAV9") != candidate_id("AAV8")
    print("PASS — candidate_id is stable and independent of PMID or order")


def main():
    registry = load_registry()

    test_formatting_variants(registry)
    test_recombinant_and_self_complementary(registry)
    test_registry_aliases(registry)
    test_generic_mentions(registry)
    test_unresolved_mentions(registry)
    test_non_candidates(registry)
    test_no_unsafe_merging(registry)
    test_id_stability(registry)

    print("PASS — identity resolver")


if __name__ == "__main__":
    main()
