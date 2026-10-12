import { withCors } from '@/lib/public-api';
export { OPTIONS } from '@/lib/public-api';
import { database, json, sameOrigin } from '@/db';
import { validateGiftSuggestion, type GiftSuggestion } from '@/lib/gifts';

export const dynamic = 'force-dynamic';
const columns = 'id, title, url, note, added_by AS addedBy, created_at AS createdAt';

async function handleGET() {
  try {
    const { results } = await database().prepare(`SELECT ${columns} FROM gift_suggestions ORDER BY created_at DESC, id DESC`).all<GiftSuggestion>();
    return json({ suggestions: results });
  } catch (error) {
    console.error('Gift suggestions read failed', error);
    return json({ error: 'Gift suggestions could not be loaded. Please try again.' }, 503);
  }
}

async function handlePOST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Please add your suggestion from this website.' }, 403);
  if (Number(request.headers.get('content-length') ?? 0) > 8192) return json({ error: 'Your suggestion is too long.' }, 413);
  let gift;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).length > 8192) return json({ error: 'Your suggestion is too long.' }, 413);
    gift = validateGiftSuggestion(JSON.parse(body));
  } catch (error) {
    return json({ error: error instanceof SyntaxError ? 'Please check your gift suggestion.' : error instanceof Error ? error.message : 'Please check your gift suggestion.' }, 400);
  }
  try {
    const db = database();
    const inserted = await db.prepare('INSERT INTO gift_suggestions (id, title, url, note, added_by, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING')
      .bind(gift.id, gift.title, gift.url, gift.note, gift.addedBy, new Date().toISOString()).run();
    const saved = await db.prepare(`SELECT ${columns} FROM gift_suggestions WHERE id = ?`).bind(gift.id).first<GiftSuggestion>();
    if (!saved) throw new Error('Saved suggestion could not be read.');
    if (saved.title !== gift.title || saved.url !== gift.url || saved.note !== gift.note || saved.addedBy !== gift.addedBy) {
      return json({ error: 'Your earlier suggestion was already saved. Refresh the page to see it before adding another.' }, 409);
    }
    return json({ suggestion: saved }, inserted.meta.changes ? 201 : 200);
  } catch (error) {
    console.error('Gift suggestion write failed', error);
    return json({ error: 'We could not confirm your suggestion. Your text is still here; try saving again.' }, 503);
  }
}

export const GET = withCors(handleGET);
export const POST = withCors(handlePOST);
