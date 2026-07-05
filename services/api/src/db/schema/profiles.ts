import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * A Profile is the practicing individual (guardian or child). Child
 * profiles are guardian-created and guardian-managed (Principle 5); a
 * standalone `profileType` column, not a role inferred from age math, keeps
 * the "is this a child profile" check a single indexed column everywhere
 * it's needed (confidence policy, consent gating, analytics exclusion).
 */
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: uuid('owner_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  profileType: text('profile_type', { enum: ['adult', 'child'] }).notNull(),
  locale: text('locale', { enum: ['en', 'ur', 'ar'] }).notNull().default('en'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Explicit guardian<->child linkage, separate from `profiles.ownerUserId`,
 * so a child profile can (post-MVP) be co-managed by more than one
 * guardian without changing profile ownership semantics.
 */
export const guardianRelationships = pgTable('guardian_relationships', {
  id: uuid('id').primaryKey().defaultRandom(),
  guardianUserId: uuid('guardian_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  childProfileId: uuid('child_profile_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  relationship: text('relationship', { enum: ['parent', 'guardian', 'teacher'] }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
