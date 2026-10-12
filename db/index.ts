import { pagesVisitor, trustedOrigin } from '@/lib/public-api';
import { env } from 'cloudflare:workers';
import { berlinDate, type Entry, type Pool } from '@/lib/pool';
export function database() { if(!env.DB) throw new Error('The shared pool is temporarily unavailable.'); return env.DB; }
export async function hash(value:string) {const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
export function participantCookie(request:Request) {return pagesVisitor(request) ?? request.headers.get('cookie')?.match(/(?:^|;\s*)arrival_participant=([a-f0-9-]{36})/)?.[1] ?? null;}
export async function readPool(participant:string|null):Promise<Pool> {
  const db=database();
  const results=await db.batch([
    db.prepare('SELECT id, name, predicted_date AS predictedDate, predicted_hour AS predictedHour, amount_cents AS amountCents, created_at AS createdAt FROM entries ORDER BY created_at DESC, id DESC'),
    db.prepare('SELECT arrival_date AS arrivalDate, arrival_at AS arrivalAt FROM event WHERE id = 1'),
    db.prepare('SELECT id FROM entries WHERE participant_hash = ?').bind(participant ? await hash(participant) : ''),
  ]);
  const event=results[1].results[0] as {arrivalDate:string;arrivalAt:string}|undefined;
  return {entries:results[0].results as Entry[], today:berlinDate(), closed:!!event, arrivalDate:event?.arrivalDate??null, arrivalAt:event?.arrivalAt??null,mine:(results[2].results[0] as {id:string}|undefined)?.id??null};
}
export const sameOrigin = trustedOrigin;
export function json(body:unknown,status=200,headers:Record<string,string>={}) {return Response.json(body,{status,headers:{'Cache-Control':'no-store',...headers}});}
