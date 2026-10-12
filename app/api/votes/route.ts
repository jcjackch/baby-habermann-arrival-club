import { withCors, pagesVisitor } from '@/lib/public-api';
export { OPTIONS } from '@/lib/public-api';
import { database, hash, json, sameOrigin } from '@/db';
import { validateVote, type VoteCounts } from '@/lib/votes';

export const dynamic = 'force-dynamic';
function voterCookie(request: Request) {
  return pagesVisitor(request) ?? request.headers.get('cookie')?.match(/(?:^|;\s*)arrival_voter=([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})(?:;|$)/i)?.[1] ?? null;
}
async function readVotes(voter: string): Promise<VoteCounts> {
  const { results } = await database().prepare('SELECT option_id AS optionId, COUNT(*) AS count, MAX(CASE WHEN voter_hash = ? THEN 1 ELSE 0 END) AS upvoted FROM option_votes GROUP BY option_id')
    .bind(await hash(voter)).all<{ optionId: string; count: number; upvoted: number }>();
  return Object.fromEntries(results.map(row => [row.optionId, { count: row.count, upvoted: !!row.upvoted }]));
}

async function handleGET(request: Request) {
  const existing = voterCookie(request), voter = existing ?? crypto.randomUUID();
  try {
    const headers: Record<string, string> = existing ? {} : { 'Set-Cookie': `arrival_voter=${voter}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}` };
    return json({ votes: await readVotes(voter) }, 200, headers);
  } catch (error) {
    console.error('Votes read failed', error);
    return json({ error: 'Upvotes could not be loaded. Please try again.' }, 503);
  }
}

async function handlePOST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Please vote from this website.' }, 403);
  const voter = voterCookie(request);
  if (!voter) return json({ error: 'Please allow cookies for this site, then refresh the upvotes before voting.' }, 409);
  if (Number(request.headers.get('content-length') ?? 0) > 1024) return json({ error: 'Your vote request is too large.' }, 413);
  let vote;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).length > 1024) return json({ error: 'Your vote request is too large.' }, 413);
    vote = validateVote(JSON.parse(body));
  } catch (error) {
    return json({ error: error instanceof SyntaxError ? 'Please check your vote.' : error instanceof Error ? error.message : 'Please check your vote.' }, 400);
  }
  try {
    const db = database();
    if (vote.optionId.startsWith('gift:')) {
      const gift = await db.prepare('SELECT id FROM gift_suggestions WHERE id = ?').bind(vote.optionId.slice(5)).first();
      if (!gift) return json({ error: 'That gift idea could not be found. Refresh the page and try again.' }, 404);
    }
    const voterHash = await hash(voter);
    if (vote.upvoted) {
      await db.prepare('INSERT INTO option_votes (option_id, voter_hash, created_at) VALUES (?, ?, ?) ON CONFLICT(option_id, voter_hash) DO NOTHING')
        .bind(vote.optionId, voterHash, new Date().toISOString()).run();
    } else {
      await db.prepare('DELETE FROM option_votes WHERE option_id = ? AND voter_hash = ?').bind(vote.optionId, voterHash).run();
    }
    return json({ votes: await readVotes(voter) });
  } catch (error) {
    console.error('Vote write failed', error);
    return json({ error: 'We could not confirm your upvote. Try again or refresh the counts.' }, 503);
  }
}

export const GET = withCors(handleGET);
export const POST = withCors(handlePOST);
