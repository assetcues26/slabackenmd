import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { config } from '../config';

const pool = new Pool({ connectionString: config.databaseUrl });

const ensureMigrationsTable = async () => {
  await pool.query(
    'create table if not exists schema_migrations (id text primary key, applied_at timestamptz default now())',
  );
};

const getAppliedMigrations = async () => {
  const result = await pool.query('select id from schema_migrations');
  return new Set(result.rows.map((row) => row.id));
};

const runMigration = async (id: string, sql: string) => {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(sql);
    await client.query('insert into schema_migrations (id) values ($1)', [id]);
    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
};

const main = async () => {
  await ensureMigrationsTable();

  const migrationsDir = path.join(__dirname, '../../migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const applied = await getAppliedMigrations();

  for (const file of files) {
    if (applied.has(file)) continue;
    const fullPath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(fullPath, 'utf8');
    await runMigration(file, sql);
    // eslint-disable-next-line no-console
    console.log(`Applied migration ${file}`);
  }

  await pool.end();
};

main().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  await pool.end();
  process.exit(1);
});
