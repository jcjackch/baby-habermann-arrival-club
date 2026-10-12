export const DUE_DATE = '2026-10-06';
export const END_DATE = '2026-11-06';
export const CONTRIBUTIONS: readonly number[] = [5, 10, 15, 20];
export const BAKERY = {
  name: 'Café Lolo',
  address: 'Heuduckstraße 67, 66117 Saarbrücken',
  website: 'https://www.cafe-lolo.de/',
  menuUrl: 'https://cafe-lolo.de/images/sortiment.pdf',
  phone: '+49 681 51828',
  phoneHref: 'tel:+4968151828',
  checkedOn: '9 October 2026',
  photoSource: 'https://www.cafe-lolo.de/images/bilder/aber_bitte_mit_sahne.jpg',
};
export const CAKES = [
  { name: 'Käsekuchen', detail: 'Small whole cake · portions not listed', cents: 1500, menuPage: 1, sourceUrl: BAKERY.menuUrl + '#page=1' },
  { name: 'Bienenstich', detail: 'Small whole cake · portions not listed', cents: 2000, menuPage: 2, sourceUrl: BAKERY.menuUrl + '#page=2' },
  { name: 'Pistaziencreme', detail: 'Small whole cake · portions not listed', cents: 2900, menuPage: 2, sourceUrl: BAKERY.menuUrl + '#page=2' },
  { name: 'Erdbeersahne', detail: 'Whole cake · 12 slices', cents: 4400, menuPage: 2, sourceUrl: BAKERY.menuUrl + '#page=2' },
  { name: 'Sachertorte', detail: 'Whole cake · 16 slices', cents: 5900, menuPage: 2, sourceUrl: BAKERY.menuUrl + '#page=2' },
];
export type Entry = { id: string; name: string; predictedDate: string; predictedHour: number; amountCents: number; createdAt: string };
export type Pool = { entries: Entry[]; today: string; closed: boolean; arrivalDate: string | null; arrivalAt: string | null; mine: string | null };
export const euros = (cents: number) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
export function berlinDate(now = new Date()) { return new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(now); }
export function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
export function dateLabel(date: string) { return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone:'UTC' }).format(new Date(date + 'T12:00:00Z')); }
export function hourLabel(hour: number) { return String(hour).padStart(2, '0') + ':00'; }
export function candidateDates(today: string) {
  if (!validDate(today) || today > END_DATE) return [];
  const count = Math.floor((Date.parse(END_DATE) - Date.parse(today)) / 86400000) + 1;
  return Array.from({ length: count }, (_, i) => new Date(Date.parse(today) + i * 86400000).toISOString().slice(0, 10));
}
export function validateEntry(input: unknown, today: string) {
  if (!input || typeof input !== 'object') throw new Error('Please fill in your name, date, hour, and contribution.');
  const b = input as Record<string,unknown>;
  const name = typeof b.name === 'string' ? b.name.trim().replace(/\s+/g,' ') : '';
  if (name.length < 2 || name.length > 50 || /[\x00-\x1f\x7f]/.test(name)) throw new Error('Use a name between 2 and 50 characters.');
  if (!validDate(b.predictedDate) || b.predictedDate < today || b.predictedDate > END_DATE) throw new Error('Pick today or a future date up to 6 November 2026.');
  if (typeof b.predictedHour !== 'number' || !Number.isInteger(b.predictedHour) || b.predictedHour < 0 || b.predictedHour > 23) throw new Error('Choose an arrival hour from 00:00 to 23:00, Berlin time.');
  if (typeof b.amount !== 'number' || !CONTRIBUTIONS.includes(b.amount)) throw new Error('Choose a contribution of €5, €10, €15, or €20.');
  if (typeof b.id !== 'string' || !/^[a-f0-9-]{36}$/.test(b.id)) throw new Error('Please reload the page and try again.');
  return { id:b.id, name, nameKey:name.normalize('NFKC').toLocaleLowerCase('en'), predictedDate:b.predictedDate, predictedHour:b.predictedHour, amountCents:b.amount*100 };
}
export function calculatePool(pool: Pool) {
  const eligible = pool.entries.filter(e => !pool.arrivalAt || e.createdAt < pool.arrivalAt);
  const total = eligible.reduce((sum,e)=>sum+e.amountCents,0);
  const cake = total/2;
  const distance = (entry: Entry) => Math.abs(Date.parse(berlinLocalToISO(entry.predictedDate + 'T' + hourLabel(entry.predictedHour)))-Date.parse(pool.arrivalAt!));
  const best = pool.arrivalAt && eligible.length ? Math.min(...eligible.map(distance)) : null;
  const winners = best === null ? [] : eligible.filter(e=>distance(e)===best).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
  const share = winners.length ? Math.floor(cake/winners.length) : 0;
  const remainder = winners.length ? cake%winners.length : 0;
  return { total, cake, prize:cake, winners:winners.map((e,i)=>({...e,payoutCents:share+(i<remainder?1:0)})), eligible };
}
export function berlinLocalToISO(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || !validDate(value.slice(0,10))) throw new Error('Enter the arrival date and time in Berlin time.');
  const naive=Date.parse(value+'Z');
  if(Number.isNaN(naive)) throw new Error('Enter a valid arrival time.');
  const guess=new Date(naive);
  const zone=new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Berlin',timeZoneName:'longOffset'}).formatToParts(guess).find(p=>p.type==='timeZoneName')!.value;
  const match=zone.match(/GMT([+-])(\d{2}):(\d{2})/);
  const offset=match ? (Number(match[2])*60+Number(match[3]))*(match[1]==='+'?1:-1):0;
  const actual=new Date(naive-offset*60000);
  const parts=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(actual).replace(' ','T');
  if(parts!==value) throw new Error('That local time is not valid.');
  return actual.toISOString();
}
