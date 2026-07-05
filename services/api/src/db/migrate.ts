import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { parseApiEnv } from '@qari/config';

const env = parseApiEnv(process.env);
const migrationClient = postgres(env.DATABASE_URL, { max: 1 });

async function run(): Promise<void> {
  await migrate(drizzle(migrationClient), { migrationsFolder: './drizzle' });
  await migrationClient.end();
  // eslint-disable-next-line no-console
  console.log('migrations applied');
}

run().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
