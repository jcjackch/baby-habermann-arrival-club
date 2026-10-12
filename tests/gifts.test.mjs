import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateGiftSuggestion, FIRST_GIFT } from '../lib/gifts.ts';

const valid = { id: '03d17728-a3e0-4d32-93d4-5b0c0a557f4d', title: 'A bedtime book', url: 'https://example.com/book', note: 'For the kids', addedBy: 'Friend' };

test('gift suggestions support text-only ideas and trim visitor input', () => {
  assert.deepEqual(validateGiftSuggestion({ id: valid.id, title: '  A bedtime book  ' }), { id: valid.id, title: 'A bedtime book', url: '', note: '', addedBy: '' });
  assert.equal(validateGiftSuggestion({ ...valid, url: ` ${valid.url} ` }).url, valid.url);
  assert.equal(FIRST_GIFT.url, 'https://www.merchandising-onlineshop.com/sv07elversberg/baby-body-neuzugang-1907-7013.html');
});

test('gift links reject executable schemes, credential links, and broken URLs', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', '//example.com', 'file:///tmp/file', 'https://friend:secret@example.com', 'https://', 'https://example.com/hello\nworld']) {
    assert.throws(() => validateGiftSuggestion({ ...valid, url }), /complete http/);
  }
});

test('invalid, oversized, and non-string gift fields are rejected', () => {
  for (const input of [null, [], { ...valid, title: ' ' }, { ...valid, title: 'x'.repeat(101) }, { ...valid, note: 'x'.repeat(401) }, { ...valid, addedBy: 'x'.repeat(51) }, { ...valid, url: 'https://example.com/' + 'a'.repeat(1000) }, { ...valid, note: {} }, { ...valid, id: 'invalid' }]) {
    assert.throws(() => validateGiftSuggestion(input));
  }
});

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'cloudflare:workers') return { url: 'data:text/javascript,export const env = {get DB(){return globalThis.__giftTestDB}};', shortCircuit: true };
    const aliases = { '@/lib/public-api': '../lib/public-api.ts', '@/db': '../db/index.ts', '@/lib/gifts': '../lib/gifts.ts', '@/lib/pool': '../lib/pool.ts' };
    if (aliases[specifier]) return { url: new URL(aliases[specifier], import.meta.url).href, shortCircuit: true };
    return next(specifier, context);
  },
});
const { GET, POST } = await import('../app/api/gifts/route.ts');

test('gift API persists across connections, retries safely, and preserves existing pool records', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'arrival-gifts-'));
  const path = join(directory, 'test.sqlite');
  let sqlite = new DatabaseSync(path);
  const migrationPath = new URL('../drizzle/', import.meta.url);
  for (const file of readdirSync(migrationPath).filter(file => file.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL(file, migrationPath), 'utf8'));
  sqlite.prepare('INSERT INTO entries (id, name, name_key, participant_hash, predicted_date, predicted_hour, amount_cents, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('existing-entry', 'Existing friend', 'existing friend', 'hash', '2026-10-15', 12, 1000, '2026-10-12T12:00:00Z');
  globalThis.__giftTestDB = {
    prepare(sql) {
      let bindings = [];
      return {
        bind(...values) { bindings = values; return this; },
        async all() { return { results: sqlite.prepare(sql).all(...bindings) }; },
        async first() { return sqlite.prepare(sql).get(...bindings) ?? null; },
        async run() { return { meta: { changes: sqlite.prepare(sql).run(...bindings).changes } }; },
      };
    },
  };
  const request = (body, origin = 'https://arrival.test') => new Request('https://arrival.test/api/gifts', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    assert.deepEqual(await (await GET()).json(), { suggestions: [] });
    assert.equal((await POST(request(valid, 'https://elsewhere.test'))).status, 403);
    assert.equal((await POST(request({ ...valid, url: 'javascript:alert(1)' }))).status, 400);
    assert.equal((await POST(request({ ...valid, note: 'a'.repeat(9000) }))).status, 413);
    assert.equal((await POST(new Request('https://arrival.test/api/gifts', { method: 'POST', headers: { Origin: 'https://arrival.test' }, body: '{bad' }))).status, 400);
    const savedResponse = await POST(request(valid));
    assert.equal(savedResponse.status, 201);
    const { suggestion } = await savedResponse.json();
    assert.equal(suggestion.title, valid.title);
    assert.ok(suggestion.createdAt);
    sqlite.close();
    sqlite = new DatabaseSync(path);
    const readResponse = await GET();
    assert.equal(readResponse.headers.get('cache-control'), 'no-store');
    assert.deepEqual((await readResponse.json()).suggestions, [suggestion]);
    assert.equal((await POST(request(valid))).status, 200, 'retrying an uncertain save must not duplicate it');
    assert.equal((await POST(request({ ...valid, title: 'Changed title' }))).status, 409);
    assert.equal((await (await GET()).json()).suggestions.length, 1);
    const textOnly = { id: '416f01c1-688c-4847-933d-20efaa872992', title: 'A handwritten story' };
    assert.equal((await POST(request(textOnly))).status, 201);
    assert.equal((await (await GET()).json()).suggestions.length, 2);
    assert.equal(sqlite.prepare('SELECT amount_cents FROM entries WHERE id = ?').get('existing-entry').amount_cents, 1000);
  } finally {
    sqlite.close();
    delete globalThis.__giftTestDB;
    rmSync(directory, { recursive: true, force: true });
  }
});
