# Qari AI — Claude Code Build Package (v1.1)

A milestone-driven build package for Claude Code, derived from the Qari AI
Comprehensive PRD, Technical Architecture spec, and Master Build Prompt v1.0,
with the v1.1 gap resolutions integrated (declared riwayah, named content
sources, mobile stack decision, capture format, provisional quality
thresholds, stub policy, and sharpened Milestone C criteria).

## Contents

| File | Purpose |
|---|---|
| `CLAUDE.md` | Persistent project memory. Place at the ROOT of your new repo. Claude Code reads it automatically every session. |
| `prompts/00-kickoff-architecture.md` | Milestone 0 — ADRs, schema, OpenAPI, state machine, backlog. No feature code. |
| `prompts/01-milestone-A-foundation.md` | CI, design system, i18n/RTL, app + service shells. |
| `prompts/02-milestone-B-content.md` | Verified Quran content import, versioning, passage browser. |
| `prompts/03-milestone-C-vertical-slice.md` | Full practice loop with a REAL forced-alignment baseline. |

Milestones D–J (offline reliability, profiles/consent, progress/rewards,
localization hardening, AI quality harness, admin tooling, deployment) follow
the same pattern — write their prompts after C proves the core loop.

## How to run

1. Create an empty git repository. Copy `CLAUDE.md` to its root. Commit.
2. Start Claude Code in that directory (`claude` in the terminal, or the
   desktop/VS Code app). Install: https://docs.claude.com/en/docs/claude-code/overview
3. Paste the contents of `prompts/00-kickoff-architecture.md` as your first
   message. Let it complete; verify the acceptance criteria yourself
   (run `pnpm test`, apply migrations) before continuing.
4. Proceed one prompt file at a time. Do NOT paste multiple milestones at once.
5. Commit at every green milestone so you can roll back.

## Session discipline (important)

- One milestone per session (or use `/clear` between milestones) — long mixed
  sessions degrade adherence to acceptance criteria.
- If Claude Code claims a milestone is done, ask it to re-run
  `pnpm lint && pnpm typecheck && pnpm test` and show output before you accept.
- Watch for the two known failure modes the prompts guard against:
  stub-substitution in Milestone C, and any Quranic Arabic appearing as a
  hand-written string literal anywhere.
- The prompts require an "Unresolved risks" section at the end of each
  milestone — read it; that is where honest limitations surface.

## Human-owner tasks Claude Code cannot do for you

- Verify and record the license for the chosen MVP reciter's audio.
- Arrange qualified human review of Urdu/Arabic UI strings and any tajweed
  educational content.
- Provide consented golden-corpus recitation clips (Milestone C).
- Final decisions on retention duration and pilot cohort.
