import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CAKE_OPTION, FIRST_GIFT_OPTION, giftOption, validateVote } from '../lib/votes.ts';

const giftId = '03d17728-a3e0-4d32-93d4-5b0c0a557f4d';
test('cake is one option and each gift has its own option', () => {
  for (const optionId of [CAKE_OPTION, FIRST_GIFT_OPTION, giftOption(giftId)]) {
    assert.deepEqual(validateVote({ optionId, upvoted: true }), { optionId, upvoted: true });
    assert.equal(validateVote({ optionId, upvoted: false }).upvoted, false);
  }
  for (const input of [null, {}, { optionId: 'cake:Käsekuchen', upvoted: true }, { optionId: 'arbitrary', upvoted: true }, { optionId: CAKE_OPTION, upvoted: 1 }, { optionId: CAKE_OPTION, upvoted: 'false' }, { optionId: 'gift:invalid', upvoted: true }]) {
    assert.throws(() => validateVote(input));
  }
});

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'cloudflare:workers') return { url: 'data:text/javascript,export const env = {get DB(){return globalThis.__voteTestDB}};', shortCircuit: true };
    const aliases = { '@/lib/public-api': '../lib/public-api.ts', '@/db': '../db/index.ts', '@/lib/votes': '../lib/votes.ts', '@/lib/pool': '../lib/pool.ts' };
    if (aliases[specifier]) return { url: new URL(aliases[specifier], import.meta.url).href, shortCircuit: true };
    return next(specifier, context);
  },
});
const { GET, POST } = await import('../app/api/votes/route.ts');

test('shared upvotes persist, allow multiple options, prevent duplicates, and undo only the current browser vote', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'arrival-votes-'));
  const path = join(directory, 'votes.sqlite');
  let sqlite = new DatabaseSync(path);
  const migrations = new URL('../drizzle/', import.meta.url);
  for (const file of readdirSync(migrations).filter(file => file.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL(file, migrations), 'utf8'));
  sqlite.prepare('INSERT INTO gift_suggestions (id, title, url, note, added_by, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(giftId, 'Book', '', 'A story', 'Friend', '2026-10-12T12:00:00Z');
  globalThis.__voteTestDB = {
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
  const readRequest = (cookie = '') => new Request('https://arrival.test/api/votes', { headers: { Cookie: cookie } });
  const voteRequest = (cookie, optionId, upvoted, origin = 'https://arrival.test') => new Request('https://arrival.test/api/votes', { method: 'POST', headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ optionId, upvoted }) });
  try {
    const initial = await GET(readRequest());
    assert.equal(initial.status, 200);
    assert.equal(initial.headers.get('Cache-Control'), 'no-store');
    const setCookie = initial.headers.get('Set-Cookie');
    assert.match(setCookie, /HttpOnly; SameSite=Strict; Max-Age=31536000; Secure/);
    const firstBrowser = setCookie.split(';')[0];
    const secondBrowser = (await GET(readRequest())).headers.get('Set-Cookie').split(';')[0];
    assert.notEqual(firstBrowser, secondBrowser);
    assert.deepEqual(await initial.json(), { votes: {} });
    assert.equal((await GET(readRequest(firstBrowser))).headers.get('Set-Cookie'), null);
    assert.equal((await POST(voteRequest('', CAKE_OPTION, true))).status, 409);
    assert.equal((await POST(voteRequest(firstBrowser, CAKE_OPTION, true, 'https://elsewhere.test'))).status, 403);
    assert.equal((await POST(voteRequest(firstBrowser, 'cake:Käsekuchen', true))).status, 400);
    assert.equal((await POST(voteRequest(firstBrowser, giftOption('416f01c1-688c-4847-933d-20efaa872992'), true))).status, 404);
    assert.equal((await POST(voteRequest(firstBrowser, 'x'.repeat(1100), true))).status, 413);

    for (const optionId of [CAKE_OPTION, FIRST_GIFT_OPTION, giftOption(giftId)]) {
      const response = await POST(voteRequest(firstBrowser, optionId, true));
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).votes[optionId], { count: 1, upvoted: true });
    }
    await Promise.all([POST(voteRequest(firstBrowser, CAKE_OPTION, true)), POST(voteRequest(firstBrowser, CAKE_OPTION, true))]);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM option_votes').get().count, 3, 'concurrent retries must not add extra votes');
    const secondView = (await (await GET(readRequest(secondBrowser))).json()).votes;
    assert.deepEqual(secondView[CAKE_OPTION], { count: 1, upvoted: false });
    await POST(voteRequest(secondBrowser, CAKE_OPTION, true));
    assert.deepEqual((await (await GET(readRequest(firstBrowser))).json()).votes[CAKE_OPTION], { count: 2, upvoted: true });

    sqlite.close();
    sqlite = new DatabaseSync(path);
    assert.deepEqual((await (await GET(readRequest(firstBrowser))).json()).votes[CAKE_OPTION], { count: 2, upvoted: true });
    await POST(voteRequest(firstBrowser, CAKE_OPTION, false));
    await POST(voteRequest(firstBrowser, CAKE_OPTION, false));
    assert.deepEqual((await (await GET(readRequest(firstBrowser))).json()).votes[CAKE_OPTION], { count: 1, upvoted: false });
    assert.deepEqual((await (await GET(readRequest(secondBrowser))).json()).votes[CAKE_OPTION], { count: 1, upvoted: true });
    assert.deepEqual((await (await GET(readRequest(firstBrowser))).json()).votes[FIRST_GIFT_OPTION], { count: 1, upvoted: true });
    const pagesRequest = new Request('https://arrival.test/api/votes', { method: 'POST', headers: { Origin: 'https://jcjackch.github.io', 'X-Arrival-Visitor': firstBrowser.split('=')[1], 'Content-Type': 'application/json' }, body: JSON.stringify({ optionId: FIRST_GIFT_OPTION, upvoted: true }) });
    const pagesResponse = await POST(pagesRequest);
    assert.equal(pagesResponse.status, 200);
    assert.equal(pagesResponse.headers.get('Access-Control-Allow-Origin'), 'https://jcjackch.github.io');
    assert.deepEqual((await pagesResponse.json()).votes[FIRST_GIFT_OPTION], { count: 1, upvoted: true }, 'Pages visitor headers preserve identity without third-party cookies');
    await POST(voteRequest(secondBrowser, CAKE_OPTION, false));
    assert.equal((await (await GET(readRequest(firstBrowser))).json()).votes[CAKE_OPTION], undefined);
    assert.equal(sqlite.prepare('SELECT title FROM gift_suggestions WHERE id = ?').get(giftId).title, 'Book');
    const hash = sqlite.prepare('SELECT voter_hash FROM option_votes LIMIT 1').get().voter_hash;
    assert.match(hash, /^[a-f0-9]{64}$/);
  } finally {
    sqlite.close(); delete globalThis.__voteTestDB;
    rmSync(directory, { recursive: true, force: true });
  }
});
