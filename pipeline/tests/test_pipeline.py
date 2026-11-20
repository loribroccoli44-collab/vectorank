"""Unit tests for the evidence gates and the identity resolver (synthetic inputs only; no model, no network).

Run from the repository root:  python3 pipeline/tests/test_pipeline.py
"""
import sys
from pathlib import Path

PIPELINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE / "evidence_gates"))
sys.path.insert(0, str(PIPELINE))
import llm_downstream as ds  # noqa: E402
from identity import resolve_candidates as p2  # noqa: E402

REG = p2.load_registry()


def ctx(value=None, status="local", span=None):
    return {"value": value, "span": span if span is not None else value, "normalized": [], "normalization_rules": [],
            "status": status if value else "unknown", "source_sentence_id": 1 if value else None, "reason": None}


def rel(mention, capsid, quote, ids=(2,), axis="none", comps=(), outcome="transduction_expression", direction="increased",
        tissue=None, model=None, route=None, status="named_capsid"):
    return {"sentence_ids": list(ids), "quote": quote, "candidate": {"mention": mention, "capsid": capsid, "status": status},
            "comparators": list(comps), "comparison_axis": axis, "outcome": outcome, "direction": direction,
            "therapeutic_effect": "unknown", "epistemic_status": "observed_result",
            "context": {"tissue": ctx(tissue), "species_model": ctx(model), "route": ctx(route)},
            "construct": {"genome_configuration": ctx(), "cargo": ctx(), "promoter": ctx()}}


def ident(r, sents=None):
    out = ds.resolve_identity(r, sents, p2, REG)
    return out["identity"].get("canonical_name"), out["basis"], out["review"]


def test_identity():
    # designation + cargo / descriptor in the mention: capsid identity only, cargo stays out of it
    assert ident(rel("rAAV1-GFP", "AAV1", "rAAV1-GFP was detectable in lung."))[:2] == ("AAV1", "mention_contains_designation")
    assert ident(rel("Recombinant BAAV", "BAAV", "Recombinant BAAV was five times more efficient."))[0] == "BAAV"
    # bare serotype fragment of an AAV list: needs a family cue in the quote
    q = "AAV 7, 8, 9, and Rh10 vectors transduce neurons."
    assert ident(rel("8", "AAV8", q))[:2] == ("AAV8", "serotype_list_fragment")
    assert ident(rel("Rh10", "AAVrh10", q), [q])[1] == "serotype_list_fragment"
    assert ident(rel("8", "AAV8", "Level 8 was reached in the assay."), ["AAV is used."])[2], "no family cue: review"
    # anaphor needs a named antecedent in an EARLIER sentence
    sents = ["An AAV2(Y-F) mutant capsid preserved expression.", "In vitro assays confirmed reduced presentation of this capsid."]
    assert ident(rel("this capsid", "AAV2(Y-F)", sents[1], ids=(2,)), sents)[1] == "anaphor_with_named_antecedent"
    assert ident(rel("this capsid", "AAV2(Y-F)", sents[1], ids=(2,)), sents[1:])[2], "no antecedent: review"
    # typographic variant, or a mention unrelated to the capsid field: never guessed
    assert ident(rel("AAV8(733)", "AAV8(Y733F)", "AAV8(733) vector genomes were recovered."))[2]
    assert ident(rel("treatment", "CPP16", "Treatment rescued function."))[2]
    assert ident(rel("AAV2", "AAV9", "AAV2 transduced liver."))[2], "conflict between mention and capsid field"
    assert ident(rel("AAV9", None, "AAV9 transduced liver."))[:2] == ("AAV9", "mention")


def test_identity_v2():
    # pseudotype slash notation: the capsid is the part AFTER the slash, cargo tail ignored
    assert ident(rel("AAV2/10", "AAV10", "AAV2/10 transduced muscle."))[:2] == ("AAV10", "pseudotype_notation")
    assert ident(rel("rAAV2/8(Y733F)", "AAV8(Y733F)", "rAAV2/8(Y733F) restored function."))[1] == "pseudotype_notation"
    assert ident(rel("AAV2/rh32.33.CB.nLacZ", "AAVrh32.33", "AAV2/rh32.33.CB.nLacZ drove infiltration."))[1] == "pseudotype_notation"
    assert ident(rel("2/8", "AAV8", "rAAV2/5, 2/8, and 2/9 vectors reached brain."))[1] == "pseudotype_notation"
    assert ident(rel("2/8", "AAV8", "Ratio 2/8 was measured."))[2], "prefix-less slash needs a family cue"
    assert ident(rel("AAV2/2", "AAV2", "AAV2/2 transduced the retina."))[:2] == ("AAV2", "pseudotype_notation")
    assert ident(rel("AAV2/8", "AAV2", "AAV2/8 transduced liver."))[2], "capsid field equal to the genome serotype is not accepted"
    # serotype fragments: "-7", "type 2", "types 1" with the family named in the abstract
    assert ident(rel("-7", "AAV7", "increased using AAV-6, -7, and -8 capsids."))[1] == "serotype_list_fragment"
    assert ident(rel("types 1", "AAV1", "types 1, 3, and 5 produced more cFIX than type 2"), ["AAV serotypes were compared."])[1] == "serotype_list_fragment"
    assert ident(rel("3", "AAV3", "Group 3 had more cells."), ["Cells were counted."])[2], "no AAV anywhere: review"
    # a capsid named only in a neighbouring sentence is not attached to a claim that does not write it
    r = rel("AAVhu68", "AAVhu68", "Treated animals showed marked transaminase elevations.", ids=(3,))
    assert not ds.identity_in_claim(r, ["AAVhu68 was dosed.", "Animals were monitored.", "Treated animals showed marked transaminase elevations."], "mention")
    assert ds.identity_in_claim(rel("AAV9", "AAV9", "AAV9 transduced liver."), None, "mention")
    assert ds.identity_in_claim(r, None, "pseudotype_notation")


def test_attribution_v2():
    # a peptide INSERTED into the capsid is the capsid's own engineering; a peptide ADDED to the vector is an intervention
    assert ds.attribution_block(rel("rAAV2.X7", "AAV2.X7", "The enhancing effect of the X7 peptide insert was replicated.")) is None
    assert ds.attribution_block(rel("AAV9", "AAV9", "A synthetic peptide enhanced transduction of AAV9.", axis="treatment"))
    assert ds.attribution_block(rel("AAV9", "AAV9", "A synthetic peptide enhanced transduction of AAV9 in brain."))
    # axis "other" alone no longer blocks; treatment / cargo / promoter / dose still do
    assert ds.attribution_block(rel("AAV5", "AAV5", "AAV5 transduced LSEC as efficiently as hepatocytes.", axis="other")) is None
    assert all(ds.attribution_block(rel("AAV5", "AAV5", "x", axis=a)) for a in ("treatment", "cargo", "promoter", "dose"))
    # a host state is not an intervention; an immunosuppressive regimen is
    assert ds.attribution_block(rel("AAV6", "AAV6", "AAV6 expression persisted for 4 months in immunosuppressed dogs.")) is None
    assert ds.attribution_block(rel("AAV8", "AAV8", "AAV8 persisted in mice under immunosuppression with rapamycin."))
    # an antibody that is the TRANSGENE is not an immune effect on the capsid; neutralizing antibodies are
    assert ds.attribution_block(rel("AAVX", "AAVX", "Systemic AAVX delivered an antibody transgene to muscle.")) is None
    assert ds.attribution_block(rel("AAV2", "AAV2", "Pre-existing neutralizing antibodies reduced AAV2 transduction."))
    assert ds.attribution_block(rel("AAV2", "AAV2", "AAV2-treated livers showed CD8(+) T-cell infiltrates and loss of expression."))


def test_attribution():
    assert ds.attribution_block(rel("AAV9", "AAV9", "x", axis="treatment"))
    assert ds.attribution_block(rel("AAV9", "AAV9", "AAV9 vectors complexed with the peptide increased expression."))
    assert ds.attribution_block(rel("AAV2", "AAV2", "AAV2-treated livers showed CD8(+) T-cell infiltrates and loss of expression.", outcome="safety_toxicity"))
    assert ds.attribution_block(rel("AAV2", "AAV2", "AAV2 induced neutralizing antibodies.", outcome="immune_response")) is None
    assert ds.attribution_block(rel("AAV9", "AAV9", "AAV9 transduced liver more than AAV8.", axis="capsid", comps=["AAV8"])) is None
    assert ds.attribution_block(rel("AAV9", "AAV9", "AAV9 expressed in mouse liver.", axis="host_or_group")) is None


def test_context():
    assert ds.clean_context("tissue", ctx("liver", span="hepatotoxicity"))[0] is None, "a phenotype is not a tissue"
    assert ds.clean_context("tissue", ctx("liver", span="liver"))[0] == "ok"
    assert ds.clean_context("tissue", ctx("motor neurons"))[0] == "ok"
    assert ds.clean_context("route", ctx("retrograde"))[0] is None
    assert ds.clean_context("route", ctx("systemic"))[0] == "ok"
    assert ds.clean_context("tissue", ctx("liver", status="recovered")) == (None, None), "recovered values are never shown"


def test_direction():
    assert not ds.direction_supported(rel("AAV1", "AAV1", "rAAV1-GFP transcripts were detectable in lung sections."))
    assert not ds.direction_supported(rel("AAV1", "AAV1", "AAV1 effectively transduces airway cells."))
    assert ds.direction_supported(rel("AAV4", "AAV4", "AAV4 gave higher expression in lung."))
    assert ds.direction_supported(rel("BAAV", "BAAV", "BAAV gene transfer was five times more efficient.", comps=["AAV-2"]))
    assert ds.direction_supported(rel("AAV4", "AAV4", "x", direction="no_change")), "only increased/decreased need a comparison"
    assert ds.direction_supported(rel("AAV4", "AAV4", "AAV4 showed liver de-targeting.", direction="decreased"))



if __name__ == "__main__":
    tests = [f for n, f in sorted(globals().items()) if n.startswith("test_") and callable(f)]
    for t in tests:
        t()
        print("PASS", t.__name__)
    print(f"{len(tests)} tests passed")
