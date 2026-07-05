# ADR-002: Database and Migrations

- Status: Accepted
- Date: 2026-07-03

## Context

CLAUDE.md §3 requires PostgreSQL 15+ and "a real migration tool (e.g.,
drizzle-kit or Prisma migrate — pick one in ADR-002 and stay consistent)."
This choice is then fixed for the life of the project.

## Decision

**drizzle-kit**, with schema defined in TypeScript under
`services/api/src/db/schema/*.ts` and SQL migrations generated into
`services/api/drizzle/`.

## Rationale

- **SQL-shaped, not ORM-shaped.** Drizzle's query builder maps closely to
  the SQL it emits. For this project the authorization model requires
  object-level checks on every attempt/recording/profile access (CLAUDE.md
  §5) — those checks are easiest to write, read, and test correctly when the
  generated SQL is predictable and the schema/query layer doesn't hide joins
  behind ORM magic.
- **Generated migrations are plain, reviewable `.sql` files.** `drizzle-kit
  generate` produces a numbered SQL file per change; it's diffable in code
  review and directly runnable against Postgres without an ORM runtime doing
  translation at apply-time. This matters for a project with a legal/audit
  surface (COPPA/GDPR-K, `AuditEvent`, `ContentIssueReport`) — the DDL
  history should be inspectable SQL, not opaque migration-engine state.
- **TypeScript-native, matches the rest of the stack.** Backend is
  TypeScript strict (CLAUDE.md §3/§5); Drizzle's schema-as-TS gives the API
  layer inferred row/insert types for free, with no separate schema DSL or
  codegen step (unlike Prisma's `.prisma` file + generated client).
- **No engine lock-in beyond Postgres**, which is already fixed. Prisma's
  broader multi-database abstraction is unneeded overhead here.

### Considered: Prisma Migrate

Prisma has a larger ecosystem and a nicer default DX for simple CRUD, but:
- Its query engine is a separate binary/runtime step, adding an indirection
  between "what the code says" and "what SQL runs" — undesirable for the
  authorization-check-heavy access patterns above.
- Migration history lives partly in Prisma's own format
  (`migration_lock.toml`, engine-applied `.sql` with less direct control
  over generated DDL for things like partial indexes and check constraints
  we anticipate needing for `Attempt.retention_state` and
  `EvaluationResult` versioning).

Prisma remains a reasonable choice; drizzle-kit is selected for the reasons
above and, per CLAUDE.md, is not to be revisited without a new ADR.

## Migration workflow

1. Edit `services/api/src/db/schema/*.ts`.
2. `pnpm --filter @qari/api drizzle:generate` → new file in
   `services/api/drizzle/NNNN_description.sql`.
3. Review the generated SQL in the PR (never hand-edit a generated file after
   generation; edit the schema and regenerate).
4. `pnpm --filter @qari/api drizzle:migrate` applies pending migrations.
   CI runs this against a throwaway Postgres (see
   `infrastructure/docker/docker-compose.yml`) as a required check.
5. Rollback is forward-only: a broken migration is fixed by a new migration,
   not by editing history, except in local development before a migration
   has been merged.

## Consequences

- Every schema change is a committed, numbered SQL file — required for the
  content-versioning rollback story in ADR-003 and for audit review.
- The concrete schema/migration files for the Milestone 0 entity set are
  delivered in this commit under `services/api/src/db/schema/` and
  `services/api/drizzle/0000_init.sql` (see file tree in the milestone
  summary).
