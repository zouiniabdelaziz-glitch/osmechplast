import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

test('employee upload route files and Pages route manifest exist', () => {
  for (const file of [
    'functions/internal/leads/[leadId]/uploads/[uploadId]/index.js',
    'functions/internal/leads/[leadId]/uploads/[uploadId]/approve.js',
    'functions/internal/leads/[leadId]/uploads/[uploadId]/reject.js',
    '_routes.json',
  ]) assert.equal(existsSync(path.join(root, file)), true, file);
  const routes = JSON.parse(readFileSync(path.join(root, '_routes.json'), 'utf8'));
  assert.deepEqual(routes.include, ['/api/leads', '/internal/leads/*']);
});
