# Coach knowledge

The AI coach answers factual training, nutrition, running, recovery and injury questions from FITR8's own
science notes, found with the `search_knowledge` tool.

- **Notes:** `packages/db/prisma/data/knowledge/<slug>.md`, loaded into the `knowledge_notes` table by the
  seed (`pnpm --filter @fitr8/db exec prisma db seed`; in production the `fitlens-migrate` job, see
  `docs/DEPLOY.md`). Removing a file removes the note on the next seed.
- **Reading list:** `docs/knowledge/sources.txt`, the reference books and open guidelines.

## Legal rules (read before adding anything)

1. **Write in our own words.** Facts, numbers and recommendations can't be copyrighted, but wording can.
   Never paste or closely paraphrase text from a book, paper or website.
2. **Cite every claim.** Each note lists its sources: prefer position stands, guidelines, systematic
   reviews and meta-analyses. Name the source in the body next to the claim it supports.
3. **Quoting open text** is only allowed for CC BY material (for example ISSN position stands) or public
   domain material (US government guidelines), with attribution. CC BY-NC material (WHO) is non-commercial:
   restate it, don't copy it.
4. **No copyrighted books in the AI.** Book text is never loaded into prompts, notes or embeddings without a
   licence from the publisher.

## Note format

```markdown
---
title: How much protein to eat
topic: nutrition
keywords: protein, grams per kg, muscle gain, protein per meal
reviewed: false
sources:
  - Jäger R, et al. ISSN Position Stand: protein and exercise. J Int Soc Sports Nutr 2017;14:20
---

- Short bullets in plain English. Numbers with units and the source that gives them (ISSN).
- Say when evidence is weak or mixed. Say who should ask a doctor or physio.
```

- `topic`: nutrition, training, running, supplements, recovery, injury, body or special.
- `keywords`: words people actually type (including Indian words: roti, dal, katori). Title and keywords
  rank above the body in search.
- `reviewed`: set to `true` only after a qualified professional (registered dietitian, S&C coach,
  physiotherapist or doctor, as fits the topic) has checked the note. All current notes are `false`.
- Never put the user's own targets in a note: those come from the app's rules and tools.
- `packages/db/scripts/knowledge.spec.ts` checks every note parses and has sources (`pnpm check`).
