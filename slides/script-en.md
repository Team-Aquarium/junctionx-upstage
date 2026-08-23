# Moabora Pitch Script (English)

Team Aquarium · JunctionX Korea 2026 Upstage Track  
**4:30** total · Live https://moabora.sharp0802.com

---

## 01 · Title · 0:00 – 0:15

Hello. We are Team Aquarium.

This is **Moabora** — an Upstage Document Agent  
that reads a notice and tells you **whether you can apply**.

The agent reads the brief. You apply.

---

## 02 · PROBLEM · 0:15 – 0:40

Notices are everywhere. The problem is not the list.

No one answers **“Can I apply?”**

We asked 20 students. The pain is consistent:

- **70%** — opening HWP, PDF, and posters to scan long briefs
- **65%** — hunting buried eligibility clauses
- **55%** — picking notices that actually fit

Students miss opportunities not from a lack of listings,  
but from the **cost of reading unstructured documents**.

---

## 03 · INSIGHT · 0:40 – 1:05

Existing boards stop at the link.

Wevity and ContestKorea collect URLs.  
They do **not** read the attached HWP or the poster.

This is not a search problem. It is a **document-understanding** problem.

Tables. Stamps. Scans. Korean HWP.

Only one stack clears that bottleneck:

**Document Parse → Information Extract → Solar.**

In our beta, finding five matching notices dropped from  
**23 minutes to 5.** About **4.6×** faster.

---

## 04 · SOLUTION · 1:05 – 1:25

Moabora finishes the job in three moves.

**Understand** — PDF, HWP, posters, HTML become structured fields.

**Judge** — six rules against your profile.  
Eligible / Needs review / Not eligible — with reasons.

**Act** — Solar scores fit 0–100 and builds a submission checklist.

We do not stop at understanding.  
We deliver the **decision and the prep**.

---

## 05 · USER JOURNEY · 1:25 – 1:40

Four steps for the user.

1. **Profile** — certificate, GitHub, or a short note. One minute.
2. **Collect** — a file, a URL, or a crawl from Wevity and ContestKorea.
3. **Feed** — every card already has a verdict and a Solar score.
4. **Apply** — reasons, a checklist, then Document Chat.

Let me walk the product.

---

## 06 · DEMO · FEED · 1:40 – 1:55

This is the notice feed.

The judging is done before you read.

Green is **Eligible**. Amber is **Needs review**. Red is **Not eligible**.

Every card carries a Solar fit score.

The graduate thesis contest is graduate-only — so it is marked Not eligible.

You are not browsing a list. You are looking at a **filtered verdict**.

---

## 07 · DEMO · INGEST · 1:55 – 2:10

Three ways to add a notice.

Paste a link. Drop a file. Or collect from the web.

All three hit the **same 4-node Studio agent**.

Parse. Classify. Extract. Instruct.

No bypass. Every stage streams a live log.

---

## 08 · DEMO · PROFILE · 2:10 – 2:25

You do not fill the profile by hand.

A GitHub link — Solar extracts interests and skills.

An enrollment certificate — Information Extract fills name, year, status.

Interests drive recommendations. Year and enrollment drive eligibility.

Those two jobs stay separate, so the verdict stays honest.

---

## 09 · DEMO · NOTICE · 2:25 – 2:40

The detail page is the **receipt**.

Solar fit 96. One-line rationale.

Per-rule checks — major, enrollment, team size.

Plus a submission checklist the agent wrote.

From here you apply, or you ask Document Chat.

---

## 10 · DEMO · DOC CHAT · 2:40 – 2:55

Ambiguous clauses go to the document itself.

“Can students on leave apply?”

Solar Pro 4 **calls Document Parse and Information Extract as tools**  
and streams its reasoning.

The answer is on page 3 of the brief. Not a guess.

---

## 11 · UPSTAGE STUDIO · 2:55 – 3:15

The core claim is one sentence.

**Every notice goes through one 4-node Studio agent.**

1. Parse — Document AI plus OCR. HWP and posters included.
2. Classify — six types.
3. Extract — ten fields.
4. Instruct — summary, eligibility-rules JSON, checklist.

We did not bypass the track requirement.  
Studio powers the core document stages.

---

## 12 · UPSTAGE PRODUCTS · 3:15 – 3:30

All four Upstage product lines run **in production**.

- **Studio Agents** — the notice pipeline
- **Document Parse** — OCR for HWP and posters
- **Information Extract** — certificates and chat schemas
- **Solar Pro 4** — fit scores, profiles, tool orchestration

This is not a combo slide.  
The four products run together inside a live service.

---

## 13 · ENGINEERING · 3:30 – 3:50

We treated Korean-document edge cases as product work.

We sanitize double-encoded JSON and citation markers.

We accumulate polling snapshots so no node output is lost.

NDJSON streams every stage and Solar’s reasoning live.

Sessions survive refresh. Dual caches stop duplicate bills.

Six rules judge deterministically — and leave a reason.

---

## 14 · SCOPE · 3:50 – 4:05

We shipped the loop in three days.

In: three ingest paths, the 4-node agent, eligibility, Solar recs, Document Chat, deploy.

Out: multi-user auth, push, a cron crawler.

The schema is already RLS-ready.

Next is auth, deadline pings, application drafts, team matching.

---

## 15 · WHY IT HOLDS UP · 4:05 – 4:20

We filled the four judging axes.

**Technology** — a custom 4-node agent. All four products. No bypass.

**Completeness** — profile to chat, live.

**Creativity** — not a link dump. An application verdict. We read HWP and posters.

**Planning** — a survey-backed problem, and honest cuts.

This is not a demo shell. It is a service **only Upstage makes possible**.

---

## 16 · LIVE · 4:20 – 4:30

The live service is already up.

**moabora.sharp0802.com**

The agent reads the brief.

You apply.

Moabora. Team Aquarium. Thank you.
