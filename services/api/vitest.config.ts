import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Milestone A's coverage bar (CLAUDE.md §5, prompt: "≥80% coverage on
      // packages/domain and auth/authorization logic") applies to the auth
      // module specifically, not the whole service — db/, server.ts are
      // wiring code exercised against a real Postgres in Milestone B+, not
      // unit-testable here without a live database (see risks section).
      include: ['src/auth/**/*.ts', 'src/logging/**/*.ts', 'src/errors.ts'],
      exclude: ['src/**/*.test.ts', 'src/auth/drizzleUserRepository.ts'],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 80,
      },
    },
  },
});
