import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const projectRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const migrationsRoot = join(projectRoot, 'migrations');

function migrationNumber(filename) {
  const match = /^(\d+)_.*\.sql$/u.exec(filename);
  return match ? Number(match[1]) : null;
}

export function openInternalTestDb({ through = '9999' } = {}) {
  const throughNumber = Number.parseInt(String(through), 10);
  if (!Number.isSafeInteger(throughNumber) || throughNumber < 0) {
    throw new TypeError('through must be a non-negative migration number');
  }

  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');

  try {
    const migrations = readdirSync(migrationsRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile() && migrationNumber(entry.name) !== null)
      .map((entry) => entry.name)
      .filter((filename) => migrationNumber(filename) <= throughNumber)
      .sort((left, right) => migrationNumber(left) - migrationNumber(right));

    for (const filename of migrations) {
      db.exec(readFileSync(join(migrationsRoot, filename), 'utf8'));
    }

    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

export function closeInternalTestDb(db) {
  db.close();
}
