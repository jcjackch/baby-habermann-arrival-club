import { withCors } from '@/lib/public-api';
export { OPTIONS } from '@/lib/public-api';
import { database, hash, json, participantCookie, readPool, sameOrigin } from '@/db';
import { berlinDate, END_DATE, validateEntry } from '@/lib/pool';
export const dynamic='force-dynamic';
async function handleGET(request:Request) {
  try {return json(await readPool(participantCookie(request)));}
  catch(error) {console.error('Pool read failed',error);return json({error:'The shared pool is temporarily unavailable. Please try again.'},503);}
}
async function handlePOST(request:Request) {
  if(!sameOrigin(request)) return json({error:'Please submit your guess from this website.'},403);
  if(Number(request.headers.get('content-length')??0)>4096) return json({error:'Entry is too large.'},413);
  let entry;
  try {entry=validateEntry(await request.json(),berlinDate());} catch(error) {return json({error:error instanceof Error?error.message:'Please check your entry.'},400);}
  if(berlinDate()>END_DATE) return json({error:'The prediction window has ended.'},409);
  const participant=participantCookie(request)??crypto.randomUUID();
  try {
    const participantHash=await hash(participant), db=database();
    const existing=await db.prepare('SELECT id FROM entries WHERE participant_hash = ? OR name_key = ? OR id = ?').bind(participantHash,entry.nameKey,entry.id).first<{id:string}>();
    if(existing) return json({error:'That name or participant already has a guess in the pool. One guess per person.'},409);
    const inserted=await db.prepare('INSERT INTO entries (id,name,name_key,participant_hash,predicted_date,predicted_hour,amount_cents,created_at) SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM event WHERE id = 1)').bind(entry.id,entry.name,entry.nameKey,participantHash,entry.predictedDate,entry.predictedHour,entry.amountCents,new Date().toISOString()).run();
    if(!inserted.meta.changes) return json({error:'The pool is closed. She has arrived!'},409);
    return json(await readPool(participant),201,{'Set-Cookie':`arrival_participant=${participant}; Path=/; HttpOnly; SameSite=Strict; Max-Age=7776000${new URL(request.url).protocol==='https:'?'; Secure':''}`});
  } catch(error) {
    if(String(error).includes('UNIQUE')) return json({error:'That name or participant already has a guess. One guess per person.'},409);
    console.error('Pool entry failed',error);return json({error:'We could not confirm your entry. Refresh the predictions before trying again.'},503);
  }
}

export const GET = withCors(handleGET);
export const POST = withCors(handlePOST);
