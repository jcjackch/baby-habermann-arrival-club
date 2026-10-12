import test from 'node:test';
import assert from 'node:assert/strict';
import { PAGES_ORIGIN, OPTIONS, pagesVisitor, trustedOrigin, withCors } from '../lib/public-api.ts';

const visitor = '03d17728-a3e0-4d32-93d4-5b0c0a557f4d';
const request = (origin, id = visitor) => new Request('https://arrival.test/api/pool', { headers: { Origin: origin, 'X-Arrival-Visitor': id } });

test('only the GitHub Pages origin and the hosted origin are trusted', () => {
  assert.equal(trustedOrigin(request(PAGES_ORIGIN)), true);
  assert.equal(trustedOrigin(request('https://arrival.test')), true);
  assert.equal(trustedOrigin(request('https://elsewhere.test')), false);
  assert.equal(trustedOrigin(new Request('https://arrival.test/api/pool')), false);
  assert.equal(pagesVisitor(request(PAGES_ORIGIN)), visitor);
  assert.equal(pagesVisitor(request('https://elsewhere.test')), null);
  assert.equal(pagesVisitor(request('https://arrival.test')), null);
  assert.equal(pagesVisitor(request(PAGES_ORIGIN, 'not-a-visitor')), null);
});

test('preflight permits browser API requests without third-party credentials', () => {
  const response = OPTIONS(request(PAGES_ORIGIN));
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), PAGES_ORIGIN);
  assert.match(response.headers.get('Access-Control-Allow-Headers'), /Authorization, X-Arrival-Visitor/);
  assert.equal(response.headers.get('Access-Control-Allow-Credentials'), null);
  assert.equal(OPTIONS(request('https://elsewhere.test')).status, 403);
});

test('API responses keep status and body, add exact-origin CORS, and omit cross-site cookies', async () => {
  const handler = withCors(async () => Response.json({ error: 'Try again' }, { status: 409, headers: { 'Cache-Control': 'no-store', 'Set-Cookie': 'arrival_participant=private; HttpOnly' } }));
  const pagesResponse = await handler(request(PAGES_ORIGIN));
  assert.equal(pagesResponse.status, 409);
  assert.deepEqual(await pagesResponse.json(), { error: 'Try again' });
  assert.equal(pagesResponse.headers.get('Access-Control-Allow-Origin'), PAGES_ORIGIN);
  assert.equal(pagesResponse.headers.get('Vary'), 'Origin');
  assert.equal(pagesResponse.headers.get('Set-Cookie'), null);
  const hostedResponse = await handler(request('https://arrival.test'));
  assert.ok(hostedResponse.headers.get('Set-Cookie'));
  assert.equal(hostedResponse.headers.get('Access-Control-Allow-Origin'), null);
});
