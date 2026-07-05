import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

export const entitlements = pgTable('entitlements', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  plan: text('plan', { enum: ['free', 'family', 'family_plus'] }).notNull().default('free'),
  status: text('status', { enum: ['active', 'expired', 'canceled'] }).notNull().default('active'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
