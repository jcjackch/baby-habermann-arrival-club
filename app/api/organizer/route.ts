import { withCors } from '@/lib/public-api';
export { OPTIONS } from '@/lib/public-api';
import { env } from 'cloudflare:workers';
import { database, hash, json, participantCookie, readPool, sameOrigin } from '@/db';
import { berlinLocalToISO, DUE_DATE } from '@/lib/pool';
async function handlePOST(request:Request) {
  if(!sameOrigin(request)) return json({error:'Please use the organizer form on this website.'},403);
  const secret=(env as unknown as Record<string,string>).ORGANIZER_CODE;
  if(!secret) return json({error:'The organizer control has not been configured.'},503);
  const provided=request.headers.get('authorization')?.replace(/^Bearer /,'')??'';
  if(provided.length>200 || await hash(provided)!==await hash(secret)) return json({error:'The organizer code is incorrect.'},401);
  let arrivalAt:string,arrivalDate:string;
  try {
    const body=await request.json() as {arrivalLocal?:unknown};
    arrivalAt=berlinLocalToISO(body.arrivalLocal); arrivalDate=(body.arrivalLocal as string).slice(0,10);
    if(arrivalDate<DUE_DATE || Date.parse(arrivalAt)>Date.now()) throw new Error('Choose an arrival time between 6 October and now.');
  } catch(error) {return json({error:error instanceof Error?error.message:'Please check the arrival time.'},400);}
  try {
    const result=await database().prepare('INSERT OR IGNORE INTO event (id,arrival_date,arrival_at) VALUES (1,?,?)').bind(arrivalDate,arrivalAt).run();
    if(!result.meta.changes) return json({error:'The arrival has already been recorded. The pool is closed.'},409);
    return json(await readPool(participantCookie(request)));
  } catch(error) {console.error('Pool closing failed',error);return json({error:'The arrival could not be saved. Please try again.'},503);}
}

export const POST = withCors(handlePOST);
