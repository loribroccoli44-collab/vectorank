"""
llm_downstream_v2 — deterministic checks applied AFTER the frozen P3 extraction (Prompt V2 / Schema V2 are untouched).

Pure functions, no model, no network, no identity-specific rule: every rule is syntactic or semantic and works on the
cited source text. They only ever HOLD or QUALIFY a relation; none of them adds a claim or a value the extraction did
not produce. Everything stays "AI-extracted — not independently validated".

  1. identity   resolve_identity(): use the extraction's normalized capsid designation when the source supports it
                (mention contains it, a bare serotype fragment of an AAV list, or an anaphor whose antecedent is named
                earlier in the abstract). Capsid identity is kept apart from cargo and genome configuration. Anything
                not clearly supported goes to REVIEW; nothing is guessed.
  2. attribution attribution_block(): an effect of a treatment, peptide, drug, co-administered agent or immune effector
                is not an intrinsic capsid property and is not published as one.
  3. context    clean_context(): a tissue / model / route is accepted only if its words are an anatomical, species or
                administration term; phenotypes ("hepatotoxicity") and transport directions ("retrograde") are rejected.
  4. direction  direction_supported(): "increased"/"decreased" need a comparator or directional wording; simple
                detection or "effectively transduces" is not superiority, and its direction is shown as unknown.
"""
import re

VERSION = "llm_downstream_v2"

SQUASH = re.compile(r"[^a-z0-9]")


def squash(text):
    return SQUASH.sub("", (text or "").lower())


# ---------------------------------------------------------------- 1. identity
FRAGMENT = re.compile(r"^(?:r?AAV[\s\-]*)?(?:(?:serotypes?|types?)\s+|-)?(rh\.?\d+|\d+[a-z]?)$", re.I)
# AAV<genome serotype>/<capsid>[cargo]: the part AFTER the slash is the capsid ("AAV2/10", "rAAV2/8(Y733F)", "AAV2/rh32.33.CB.nLacZ")
PSEUDOTYPE = re.compile(r"^(r?AAV)?(\d{1,2})\s*/\s*(.+)$", re.I)   # prefix-less "2/8" needs a family cue in the claim
ABSTRACT_FAMILY = re.compile(r"\bAAV[\s\-]*(?:serotypes?|types?)\b|\bserotypes?\b", re.I)
ANAPHOR = re.compile(r"^(?:this|that|the|these|those|such|our)\s+(?:\w+\s+){0,2}(?:capsid|vector|variant|serotype)s?$", re.I)
FAMILY_CUE = re.compile(r"AAV|serotype", re.I)   # also matches "rAAV2/5"
AAV_LIKE = re.compile(r"aav", re.I)
NON_AAV_SHAPE = re.compile(r"^[A-Za-z][A-Za-z0-9.\-/()]{2,}$")


def _has_digit_or_acronym(name):
    return bool(re.search(r"\d", name)) or len(re.findall(r"[A-Z]", name)) >= 2


def resolve_identity(rel, sentences, p2, registry):
    """-> dict(identity=<p2 identity or None>, basis=str, review=None|reason).

    `sentences` is the abstract split into sentences (sentence ids in the extraction are 1-based) or None. The frozen
    extraction supplies `candidate.mention` (as written) and `candidate.capsid` (its normalized designation or None)."""
    cand = rel["candidate"]
    mention, capsid = (cand["mention"] or "").strip(), (cand.get("capsid") or "").strip()
    by_mention = p2.resolve(mention, registry)
    if not capsid or squash(capsid) == squash(mention):
        return {"identity": by_mention, "basis": "mention", "review": None}
    by_capsid = p2.resolve(capsid, registry)
    if by_capsid["identity_status"] != p2.RESOLVED:
        return {"identity": by_mention, "basis": "mention", "review": None}
    quote = rel["quote"]
    abstract = " ".join(sentences) if sentences else quote
    first_sid = min(rel["sentence_ids"]) if rel["sentence_ids"] else 1
    cap_sq = squash(capsid)
    pt = PSEUDOTYPE.match(mention)
    if pt and (pt.group(1) or FAMILY_CUE.search(quote)):  # genome serotype before the slash, capsid after it
        tail_sq = squash(pt.group(3))
        cap_suffix = squash(re.sub(r"^r?aav", "", capsid, flags=re.I))
        if cap_suffix and tail_sq.startswith(cap_suffix):  # "AAV2/2": genome 2, capsid 2 is fine; "AAV2/8" with capsid AAV2 is not
            return {"identity": by_capsid, "basis": "pseudotype_notation", "review": None}
        return {"identity": by_mention, "basis": "mention",
                "review": "identity_needs_review:pseudotype_capsid_not_the_part_after_the_slash"}
    if cap_sq in squash(mention):  # "rAAV1-GFP", "AAV2(Y-F) mutant capsid", "Recombinant BAAV": designation + cargo/descriptor
        return {"identity": by_capsid, "basis": "mention_contains_designation", "review": None}
    m = FRAGMENT.match(mention)
    if m and re.match(r"^r?aav", capsid, re.I):
        suffix = squash(re.sub(r"^r?aav", "", capsid, flags=re.I))
        cue = FAMILY_CUE.search(quote) or (re.search(r"\btypes?\b", quote, re.I) and ABSTRACT_FAMILY.search(abstract))
        if squash(m.group(1)) == suffix and cue and re.search(r"AAV", abstract, re.I):
            return {"identity": by_capsid, "basis": "serotype_list_fragment", "review": None}
    if ANAPHOR.match(mention) and sentences:
        earlier = " ".join(sentences[:max(first_sid - 1, 0)])
        if cap_sq in squash(earlier) and cap_sq not in {squash(c) for c in rel["comparators"] if isinstance(c, str)}:
            return {"identity": by_capsid, "basis": "anaphor_with_named_antecedent", "review": None}
    return {"identity": by_mention, "basis": "mention", "review": "identity_needs_review:capsid_field_not_supported_by_source"}


def explicit_capsid_cue(name, sentences):
    """A non-"AAV" designation (BAAV is AAV-like; Anc80L65, MC5 are not) is accepted only where the abstract itself
    calls it a capsid / variant / serotype / vector / AAV, right next to the name."""
    if not sentences:
        return False
    n = re.escape(name)
    before = re.compile(rf"\b(?:capsid|variant|serotype|vector|virus|AAV|rAAV)s?\b[\s,:()\-]*(?:\w+\s+){{0,3}}{n}(?!\w)", re.I)
    after = re.compile(rf"(?<!\w){n}[\s,)]*(?:\w+\s+){{0,2}}(?:capsid|variant|serotype|vector)s?\b", re.I)
    return any(before.search(s) or after.search(s) for s in sentences)


SUPPORTED_BASES = ("mention_contains_designation", "serotype_list_fragment", "anaphor_with_named_antecedent", "pseudotype_notation")


def identity_in_claim(rel, sentences, basis):
    """The capsid must be NAMED in the cited claim sentence(s), or reached by a source-supported rule above. A capsid the
    extraction only implies (named in a neighbouring sentence) is not attached to a claim it is not written in."""
    if basis in SUPPORTED_BASES:
        return True
    ids = [i for i in rel.get("sentence_ids") or [] if sentences and 1 <= i <= len(sentences)]
    cited = squash(" ".join(sentences[i - 1] for i in ids)) if ids else ""
    cited += squash(rel["quote"])
    cand = rel["candidate"]
    return any(squash(x) and squash(x) in cited for x in (cand.get("mention"), cand.get("capsid")))


def defined_as_non_aav_virus(name, sentences):
    """True when the abstract itself introduces `name` as the abbreviation of a virus that is not an AAV, e.g.
    "Human bocavirus virus-1 (HBoV1)". An AAV catalogue keeps AAV capsids only; "serpentine adeno-associated virus (SAAV)"
    is an AAV and passes. Semantic (a virus word right before "(NAME)"), not a list of names."""
    if not sentences or not name:
        return False
    pat = re.compile(rf"([^.;]{{0,80}}virus[^.;()]{{0,30}})\(\s*{re.escape(name)}\s*\)", re.I)
    for sentence in sentences:
        m = pat.search(sentence)
        if m and not re.search(r"adeno[\s-]*associated|\bAAV", m.group(1), re.I):
            return True
    return False


MUTATION = re.compile(r"^[A-Z]\d{2,4}[A-Z]$")                       # R404A: an amino-acid substitution
ACCESSION = re.compile(r"^[A-Z]{1,3}_?\d{5,}(\.\d+)?(/.*)?$")           # UNY47950.1: a sequence database accession
PSEUDOTYPE_NAME = re.compile(r"^r?AAV\d{1,2}/[\w.()\-]+$", re.I)


def _core(key):
    """Letters/digits of a name without a leading AAV and serotype digits: 'aav9phpb' and 'aavphpb' both -> 'phpb'."""
    return re.sub(r"^r?aav\d*", "", key)


def name_gate(designation, basis, quote, sentences, existing_keys, cargo_re, aav_re):
    """None if `designation` may become a NEW profile, else the reason. Syntactic, no list of known capsids."""
    d = designation.strip()
    if squash(d) in {"aav", "raav"}:
        return "name_is_not_an_aav_designation"
    # Strings that look like a capsid name but are another kind of identifier: never a new profile.
    if defined_as_non_aav_virus(d, sentences) or defined_as_non_aav_virus(re.sub(r"^r?AAV\d*/", "", d), sentences):
        return "name_is_a_non_aav_virus"
    if MUTATION.match(d):
        return "name_is_a_point_mutation_not_a_capsid"
    if ACCESSION.match(d):
        return "name_is_a_sequence_accession"
    if "/" in d and not (PSEUDOTYPE_NAME.match(d) and d.count("/") == 1):
        return "name_has_a_slash_that_is_not_a_pseudotype"
    if not aav_re.match(d) and not AAV_LIKE.search(d) and not re.search(r"\d", d) and re.fullmatch(r"[A-Z]{5,12}", d):
        return "name_looks_like_a_peptide_or_acronym"
    if not aav_re.match(d):  # not "AAV..."/"rAAV...": BAAV, AAVMYO-like names need only a clean shape; others need evidence
        if not NON_AAV_SHAPE.match(d):
            return "name_is_not_an_aav_designation"
        if not AAV_LIKE.search(d):
            if not _has_digit_or_acronym(d):
                return "name_is_not_an_aav_designation"
            if not explicit_capsid_cue(d, sentences):
                return "non_aav_name_without_explicit_capsid_evidence"
    if cargo_re.search(d):
        return "name_carries_cargo_or_construct_token"
    supported = basis in SUPPORTED_BASES
    if not supported and squash(d) not in squash(quote):
        return "name_not_in_the_cited_claim_sentence"
    if squash(d) in existing_keys:
        return "possible_duplicate_of_existing_identity"
    core = _core(squash(d))
    if len(core) >= 4 and any(_core(k) == core for k in existing_keys):  # "AAV-PHP.B" vs the existing "AAV9-PHP.B"
        return "possible_duplicate_of_existing_identity"
    return None


def name_basis(name, aav_re):
    """Why a (possibly non-"AAV...") designation was accepted as a capsid name; recorded on AI-discovered profiles."""
    if aav_re.match(name):
        return "aav_designation"
    return "aav_substring" if AAV_LIKE.search(name) else "explicit_capsid_cue_in_abstract"


# ---------------------------------------------------------------- 2. attribution
INTERVENTION = re.compile(
    r"\b(complexed with|co-?administ\w*|pre-?treat\w*|treated with|treatment with|steroid\w*|methylprednisolone|"
    r"dexamethasone|rapamycin|ibrutinib|(?:with|under|following|plus)\s+(?:\w+\s+){0,2}immuno-?suppress\w*|immuno-?suppress\w*\s+(?:regimen|therapy|treatment|drugs?)|adoptive(?:ly)? transfer\w*|nanoparticles?|exosomes?|"
    r"encapsulat\w*|shuttle|in combination with|combined with|plasmapheresis|antagonists?)\b"
    r"|\b(?:with|plus|using|treated with|in the presence of)\s+(?:\w+[\s-]+){0,2}inhibitors?\b", re.I)
# A peptide counts as an intervention only when it is something ADDED to the vector; a peptide inserted into or displayed on
# the capsid is the capsid's own engineering (rAAV2.NN, PHP.B-type variants) and an effect of it IS a capsid property.
PEPTIDE = re.compile(r"\bpeptides?\b", re.I)
CAPSID_ENGINEERING = re.compile(r"\b(insert\w*|display\w*|substitut\w*|loop|VP\d|7-?mer|library|capsid[- ]?(?:modified|engineered)|"
                                r"modified capsid|engineered capsid|variant|mutant)\b", re.I)
# Cellular effectors always act ON transduced cells. Antibodies count only as ANTI-capsid / neutralizing effects: an antibody
# can also be the transgene the vector delivers ("AAV-encoded antibody"), which is not an immune effect on the capsid.
IMMUNE_EFFECTOR = re.compile(r"\b(T[- ]?cells?|CD8\S*|CD4\S*|cytotoxic|neutraliz\w+|pre-?existing\s+(?:\w+\s+)?antibod\w+|"
                             r"anti[- ]?(?:AAV|capsid)\s+antibod\w+)", re.I)
# "other" is an unspecified contrast, not evidence that the effect is not the capsid's: it no longer blocks by itself.
NOT_CAPSID_AXES = {"treatment", "cargo", "promoter", "dose"}


def attribution_block(rel):
    """-> reason string if the effect should not be shown as an intrinsic capsid result, else None."""
    axis, quote, outcome = rel.get("comparison_axis"), rel["quote"], rel.get("outcome")
    if axis in NOT_CAPSID_AXES:
        return f"effect_not_attributable_to_capsid:comparison_axis={axis}"
    if outcome != "immune_response":
        if INTERVENTION.search(quote) or (PEPTIDE.search(quote) and not CAPSID_ENGINEERING.search(quote)):
            return "effect_not_attributable_to_capsid:intervention_in_claim"
        if IMMUNE_EFFECTOR.search(quote):
            return "effect_not_attributable_to_capsid:immune_effector_in_claim"
    return None


# ---------------------------------------------------------------- 3. context
TISSUE_INVALID = re.compile(r"(toxic|patholog|disease|syndrome|response|inflammat|infect|surviv|express|transduc|antibod|titer|"
                            r"level|function|phenotype|deficien|dystroph|damage|injury|necrosis)", re.I)
ROUTE_INVALID = re.compile(r"^(retrograde|anterograde|transport|delivery|targeting|uptake|trafficking)$", re.I)
MODEL_INVALID = re.compile(r"(toxic|patholog|disease|response|express|transduc|antibod)", re.I)


def clean_context(kind, ctx):
    """-> (value|None, reason|None). Only called for a value the extraction marked local."""
    if not ctx or ctx.get("status") != "local":
        return None, None
    words = (ctx.get("span") or ctx.get("value") or "")
    bad = {"tissue": TISSUE_INVALID, "species_model": MODEL_INVALID}.get(kind)
    if bad and bad.search(words):
        return None, f"{kind}_not_an_anatomical_or_species_term:{words}"
    if kind == "route" and ROUTE_INVALID.match(words.strip()):
        return None, f"route_not_an_administration_route:{words}"
    return "ok", None


# ---------------------------------------------------------------- 4. direction
CHANGE_WORDS = re.compile(
    r"\b(than|compared|comparison|versus|vs\.?|relative to|in contrast|whereas|superior\w*|higher|greater|lower|less|fewer|most|best|"
    r"more|better|improv\w*|enhanc\w*|increas\w*|reduc\w*|decreas\w*|declin\w*|diminish\w*|detarget\w*|de-target\w*|abolish\w*|"
    r"restor\w*|rescu\w*|prevent\w*|alleviat\w*|loss|lost|boost\w*|elevat\w*|augment\w*)\b|\d+\s*-?\s*(?:fold|times)", re.I)


def direction_supported(rel):
    """False when increased/decreased has neither a named comparator nor wording that states a change. A claim of simple
    detection ("detectable in", "effectively transduces") is not a comparison and must not read as superiority."""
    if rel.get("direction") not in ("increased", "decreased"):
        return True
    return bool(rel.get("comparators")) or bool(CHANGE_WORDS.search(rel["quote"]))
