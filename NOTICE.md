# Data and third-party material

VectoRank Beta reads two data files, both generated from published literature:

- `data/demo/vectorank_demo_v1.json`: PubMed bibliographic records (title, journal, year, PMID) and relations extracted
  by fixed text rules from article abstracts.
- `data/demo/vectorank_llm_evidence_v1.json`: relations extracted from the same abstracts by a language model (Google
  Gemini Flash) and filtered by automatic checks.

**Third-party text.** The articles belong to their authors and publishers. This site reproduces a source sentence only
where Europe PMC licence metadata states CC BY or CC0 for the article; each such sentence is shown unmodified with
attribution and a link to the licence record. For every other article no abstract text is reproduced: only
bibliographic facts, the extracted structured fields and a link to PubMed are shown. The licence of the structured
fields themselves has not been decided; nothing in this repository grants rights in third-party articles.

**No warranty.** The extracted evidence is machine-generated and has not been independently validated. It may be
incomplete or wrong and must not be used for clinical, regulatory or purchasing decisions.

**Software licence.** Not yet chosen by the repository owner. Until a licence file is added, all rights are reserved.

## Original work and third-party material

| Material | Origin |
|---|---|
| `app/`, `lib/`, `scripts/`, `pipeline/` source code | Original work of the repository author. |
| `pipeline/identity/alias_registry.json` | Hand-maintained by the author; each entry carries a written reason. |
| `data/demo/*.json` | Generated from third-party articles. Bibliographic facts come from PubMed and Europe PMC. Source sentences are included only for articles whose Europe PMC licence metadata states CC BY or CC0, unmodified, each with attribution and a licence link in the record. Structured fields are machine-extracted and unreviewed. |
| `public/*.png` | Illustrations by the author; see `ASSETS.md`. |
| `docs/img/*.png` | Screenshots of this application. |

Publishing this repository on GitHub does not grant, and cannot grant, any rights in third-party articles.
