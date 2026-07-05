import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  locale: text('locale', { enum: ['en', 'ur', 'ar'] }).notNull().default('en'),
  /**
   * Guest accounts (CLAUDE.md OpenAPI /auth/guest-upgrade flow, Milestone A
   * task "guest session issuance") are real `users` rows with a
   * system-generated placeholder email and an unusable random password
   * hash, so profile ownership FKs work unchanged — `isGuest` is what
   * distinguishes them and what `guest-upgrade` flips to false.
   */
  isGuest: boolean('is_guest').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
