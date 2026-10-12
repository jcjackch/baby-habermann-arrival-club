'use client';
import { siteFetch } from '@/lib/api-client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Heart, CakeSlice, Sparkles, Trophy, Users, Check, LockKeyhole, CalendarHeart, RefreshCw } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import CakeMenu from './cake-menu';
import GiftBoard from './gift-board';
import { UpvoteProvider, UpvoteHelp } from './upvotes';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { BAKERY, CAKES, CONTRIBUTIONS, DUE_DATE, END_DATE, calculatePool, candidateDates, dateLabel, hourLabel, euros, validateEntry, type Pool } from '@/lib/pool';

type ModelTool = { name:string; title:string; description:string; inputSchema:object; annotations:{readOnlyHint:boolean;untrustedContentHint:boolean}; execute:(input:unknown)=>unknown };
type ModelContext={registerTool:(tool:ModelTool,options:{signal:AbortSignal})=>void|Promise<void>};

export default function Home() {
  const [pool,setPool]=useState<Pool|null>(null), [loading,setLoading]=useState(true), [loadError,setLoadError]=useState('');
  const [name,setName]=useState(''), [predictedDate,setPredictedDate]=useState(''), [predictedHour,setPredictedHour]=useState('12'), [showAllDates,setShowAllDates]=useState(false), [amount,setAmount]=useState('5');
  const [busy,setBusy]=useState(false), [error,setError]=useState(''), [saved,setSaved]=useState(false);
  const [organizerCode,setOrganizerCode]=useState(''), [arrivalLocal,setArrivalLocal]=useState(''), [adminBusy,setAdminBusy]=useState(false), [adminError,setAdminError]=useState('');
  const poolRef=useRef(pool); poolRef.current=pool;
  async function refresh() {
    try {const response=await siteFetch('/api/pool',{cache:'no-store'});const data=await response.json() as Pool & {error?:string};if(!response.ok) throw new Error(data.error);setPool(data);setLoadError('');}
    catch(e){setLoadError(e instanceof Error?e.message:'The pool could not be loaded.');}finally{setLoading(false);}
  }
  useEffect(()=>{void refresh();const interval=setInterval(()=>void refresh(),30000);return()=>clearInterval(interval);},[]);
  useEffect(()=>{if(pool?.today&&!predictedDate)setPredictedDate(pool.today);},[pool?.today,predictedDate]);
  useEffect(()=>{
    const context=(document as Document&{modelContext?:ModelContext}).modelContext;
    if(!context?.registerTool)return;
    const controller=new AbortController();
    const register=(tool:ModelTool)=>{try{Promise.resolve(context.registerTool(tool,{signal:controller.signal})).catch(()=>{});}catch{}};
    register({name:'read_arrival_pool',title:'Read the arrival pool',description:'Read the current registered guesses, pledged prize split, and affordable cake choices.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>{const p=poolRef.current;if(!p)throw new Error('The pool has not loaded.');const summary=calculatePool(p);return {...p,...summary,bakery:BAKERY,cakes:CAKES.map(c=>({...c,affordable:c.cents<=summary.cake}))};}});
    register({name:'prepare_arrival_guess',title:'Prepare an arrival guess',description:'Fill in the visible entry form. This does not submit or register a guess; the visitor reviews and presses Register my guess.',inputSchema:{type:'object',properties:{name:{type:'string',minLength:2,maxLength:50},predictedDate:{type:'string',description:'YYYY-MM-DD'},predictedHour:{type:'integer',minimum:0,maximum:23,description:'Berlin local hour, from 0 to 23'},amount:{type:'integer',enum:CONTRIBUTIONS}},required:['name','predictedDate','predictedHour','amount'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async(input)=>{const p=poolRef.current;if(!p||p.closed||p.mine)throw new Error('This pool cannot accept another guess from you.');const entry=validateEntry({...input as object,id:crypto.randomUUID()},p.today);setName(entry.name);setPredictedDate(entry.predictedDate);setPredictedHour(String(entry.predictedHour));setAmount(String(entry.amountCents/100));setError('');document.getElementById('entry-form')?.scrollIntoView({block:'center'});await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));return {status:'prepared',submitted:false,name:entry.name,predictedDate:entry.predictedDate,predictedHour:entry.predictedHour,amount:entry.amountCents/100};}});
    return()=>controller.abort();
  },[]);
  async function submit(event:FormEvent) {
    event.preventDefault();setError('');if(!pool)return;
    const payload={name,predictedDate,predictedHour:Number(predictedHour),amount:Number(amount),id:crypto.randomUUID()};
    try {validateEntry(payload,pool.today);}catch(e){setError((e as Error).message);return;}
    setBusy(true);
    try {const response=await siteFetch('/api/pool',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await response.json() as Pool & {error?:string};if(!response.ok)throw new Error(data.error);setPool(data);setSaved(true);toast.success('Your guess is in. Let the sweet anticipation begin!');}
    catch(e){setError(e instanceof Error?e.message:'Could not save your guess.');}finally{setBusy(false);}
  }
  async function closePool() {
    setAdminBusy(true);setAdminError('');
    try {const response=await siteFetch('/api/organizer',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${organizerCode}`},body:JSON.stringify({arrivalLocal})});const data=await response.json() as Pool & {error?:string};if(!response.ok)throw new Error(data.error);setPool(data);setOrganizerCode('');toast.success('Welcome, little one! The results are ready.');}
    catch(e){setAdminError(e instanceof Error?e.message:'Could not close the pool.');}finally{setAdminBusy(false);}
  }
  const summary=pool?calculatePool(pool):null;
  const mine=pool?.entries.find(e=>e.id===pool.mine);
  const closed=pool?.closed??false,expired=!!pool&&pool.today>END_DATE;
  const money=(value:number|undefined)=>value===undefined?'—':euros(value);
  const [whole,fraction]=summary?euros(summary.total).split('.'):['—',''];
  const allDates=pool?candidateDates(pool.today):[];
  const remainingDays=showAllDates?allDates:allDates.slice(0,14);
  return <div className="site-shell">
    <Toaster position="bottom-right" theme="light"/>
    <header className="topbar"><a className="brand" href="./"><Heart size={24} fill="currentColor"/><span>the arrival club<span className="brand-dot" aria-hidden="true">✳</span></span></a><nav aria-label="Page sections"><a href="#predictions">The guesses</a><a href="#celebration">Cakes & gifts</a></nav><span className="top-note">A LITTLE GUESS. A LOT OF LOVE.</span></header>
    <main>
    <section className="intro"><div><p className="eyebrow">FOR MARC & HIS LITTLE GIRL</p><h1>{closed?<>She&apos;s here.<br/><em>How sweet is that?</em></>:<>Good things take<br/><em>their sweet time.</em></>}</h1><p className="intro-copy">{closed?`Welcome to the world, Baby Habermann. Born ${dateLabel(pool!.arrivalDate!)} 2026.`:<>Baby Habermann is on her way. Pick her arrival date,<br className="desktop-break"/> join the pool, and help make her first cake a sweet one.</>}</p></div><div className="due-stamp"><span>{closed?'WELCOME, LITTLE ONE':'ON HER OWN TIME'}</span><strong>{closed?pool!.arrivalDate!.slice(-2):'06'}</strong><span>{closed?new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(pool!.arrivalDate!)).toUpperCase():'OCTOBER 2026'}</span><small>{closed?'Her big arrival':'Her original due date'}</small></div></section>
    {loadError&&<div className="notice error-notice" role="alert"><span>{loadError} {pool?'The totals below may be out of date.':''}</span><button onClick={()=>void refresh()}><RefreshCw size={16}/> Try again</button></div>}
    <section className="entry-grid">
      <div className="entry-card">
        <div className="section-head"><h2>{closed?'A very happy result.':mine?'Your guess is in!':'When will she say hello?'}</h2>{closed?<Heart size={24}/>:<Sparkles size={24}/>}</div>
        {closed?<div className="result-panel"><p className="muted">The closest date and hour wins. Time to celebrate!</p>{summary!.winners.length?<div className="winner-list">{summary!.winners.map(w=><div className="winner" key={w.id}><Trophy size={22}/><div><strong>{w.name}</strong><p>Guessed {dateLabel(w.predictedDate)} at {hourLabel(w.predictedHour)}</p></div><strong>{euros(w.payoutCents)}</strong></div>)}</div>:<p className="muted">No eligible guesses were registered before her arrival.</p>}<p className="fine-print">Payouts are based on pledged contributions. Settle contributions and prizes with the organizer.</p></div>:mine?<div className="registered-panel"><span className="success-icon"><Check size={30}/></span><strong>{mine.name}</strong><p>You&apos;re calling <b>{dateLabel(mine.predictedDate)} at {hourLabel(mine.predictedHour)} Berlin time</b>.</p><div className="receipt"><span>Your pledge<strong>{euros(mine.amountCents)}</strong></span><span>To the cake<strong>{euros(mine.amountCents/2)}</strong></span></div><p className="fine-print">{saved?'Saved for everyone to see. ':''}Please give your contribution to the organizer. Your guess is locked in.</p></div>:<form id="entry-form" onSubmit={submit}>
          <p className="muted">Your best guess deserves a place in the calendar.</p>
          <fieldset disabled={busy||loading||!pool||expired}>
          <div className="form-fields"><label htmlFor="name">Your name<input id="name" name="name" autoComplete="name" minLength={2} maxLength={50} required value={name} onChange={e=>setName(e.target.value)}/></label><label htmlFor="date">Your predicted date<input id="date" type="date" required min={pool?.today} max={END_DATE} value={predictedDate} onChange={e=>setPredictedDate(e.target.value)}/></label><label htmlFor="hour">Arrival hour · Berlin<Select name="predictedHour" value={predictedHour} onValueChange={setPredictedHour} disabled={busy||loading||!pool||expired}><SelectTrigger id="hour" className="hour-select"><SelectValue/></SelectTrigger><SelectContent>{Array.from({length:24},(_,hour)=><SelectItem key={hour} value={String(hour)}>{hourLabel(hour)}</SelectItem>)}</SelectContent></Select></label></div>
          <div className="date-options-head"><span>{remainingDays.length?`${dateLabel(remainingDays[0])} – ${dateLabel(remainingDays[remainingDays.length-1])}`:"Choose an arrival date"}</span>{allDates.length>14&&<button type="button" aria-expanded={showAllDates} aria-controls="quick-date-options" onClick={()=>setShowAllDates(!showAllDates)}>{showAllDates?"Show fewer dates":"All dates through 6 Nov"}</button>}</div>
          <div id="quick-date-options" className="quick-dates" aria-label="Quick date choices">{remainingDays.map(d=><button key={d} type="button" aria-label={`${dateLabel(d)} 2026`} aria-pressed={predictedDate===d} className={predictedDate===d?'selected':''} onClick={()=>setPredictedDate(d)}><span>{new Intl.DateTimeFormat('en-GB',{weekday:'short',timeZone:'UTC'}).format(new Date(d))}</span><strong>{Number(d.slice(-2))}</strong>{d.slice(-2)==="01"&&<span>{new Intl.DateTimeFormat("en-GB",{month:"short",timeZone:"UTC"}).format(new Date(d))}</span>}</button>)}</div>
          <div className="contribution-field"><span id="contribution-label">Your contribution</span><RadioGroup name="contribution" value={amount} onValueChange={setAmount} required disabled={busy||loading||!pool||expired} aria-labelledby="contribution-label" className="contribution-options">{CONTRIBUTIONS.map(value=><label className="contribution-option" key={value}><RadioGroupItem value={String(value)} aria-label={`${value} euros`}/><span>€{value}</span></label>)}</RadioGroup></div>
          <button className="primary-button" type="submit">{busy?'Saving your guess…':loading?'Loading the pool…':expired?'Predictions have ended':'Register my guess'}</button>
          </fieldset>
          {error&&<p className="form-error" role="alert">{error}</p>}
          <p className="fine-print">One guess per person · Contributions collected separately</p>
        </form>}
      </div>
      <aside className="pool-card" aria-label="Prize pool"><span className="eyebrow">THE SHARED PRIZE POOL</span><strong className="pool-total">{whole}{fraction&&<span>.{fraction}</span>}</strong><p>{closed?'A little prize. A lovely welcome.':'Every guess makes the celebration sweeter.'}</p><div className="pool-split"><div><Trophy size={23}/><span>Winner&apos;s pot</span><strong>{money(summary?.prize)}</strong><small>50% of the pool</small></div><div><CakeSlice size={23}/><span>Birthday cake</span><strong>{money(summary?.cake)}</strong><small>50% of the pool</small></div></div><div className="pool-foot"><Users size={16}/><span>{pool?`${summary!.eligible.length} ${summary!.eligible.length===1?'guess':'guesses'} · ${closed?'Final pledged pool':'Pledged so far'}`:'Loading shared totals…'}</span></div></aside>
    </section>
    <UpvoteProvider><section className="celebration-section" id="celebration" aria-label="Cakes and gifts">
      <UpvoteHelp/>
      <CakeMenu budget={summary?.cake ?? null}/>
      <GiftBoard/>
    </section></UpvoteProvider>
    <section className="predictions-section" id="predictions"><div className="section-head"><div><p className="eyebrow">THE FRIENDLY COMPETITION</p><h2>Everyone&apos;s best guess.</h2></div><span className="count-pill">{pool?.entries.length??'—'} guesses</span></div>{loading?<p className="loading-message" role="status">Loading everyone&apos;s predictions…</p>:!pool?<p className="loading-message">Predictions are unavailable right now. Use “Try again” above.</p>:pool.entries.length===0?<Empty className="empty-pool"><EmptyHeader><CalendarHeart size={32} strokeWidth={1.5}/><EmptyTitle>No guesses yet. All dates are up for grabs.</EmptyTitle><EmptyDescription>Be the first to put a date on the calendar and a little love in the cake fund.</EmptyDescription></EmptyHeader></Empty>:<Table className="guesses-table"><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Arrival guess · Berlin</TableHead><TableHead>Contribution</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{[...pool.entries].sort((a,b)=>a.predictedDate.localeCompare(b.predictedDate)||a.predictedHour-b.predictedHour||a.createdAt.localeCompare(b.createdAt)).map(e=><TableRow key={e.id}><TableCell><span className="avatar" aria-hidden="true">{e.name.slice(0,1).toUpperCase()}</span><span className="entry-name">{e.name}</span>{e.id===pool.mine&&<small className="you-label">You</small>}</TableCell><TableCell>{dateLabel(e.predictedDate)} · {hourLabel(e.predictedHour)}</TableCell><TableCell>{euros(e.amountCents)}</TableCell><TableCell><span className="entry-status">{summary?.winners.some(w=>w.id===e.id)?'Winner':pool.arrivalAt&&e.createdAt>=pool.arrivalAt?'After birth · return pledge':closed?'Thanks for playing':'Guess locked in'}</span></TableCell></TableRow>)}</TableBody></Table>}
    </section>
    <section className="rules-section"><h2>A few sweet ground rules.</h2><div className="rules-grid"><div><span>01</span><h3>A date, a name, a little love.</h3><p>One locked-in guess per person. Choose a date and hour up to 6 November 2026, and contribute €5, €10, €15, or €20. Your name, date, hour, and pledge will be visible to everyone with access.</p></div><div><span>02</span><h3>Half for you. Half for her.</h3><p>The closest predicted date and hour (at HH:00) wins 50% of the pool. Tied winners share it equally; spare cents go to earlier entries. The other 50% goes to her birthday cake.</p></div><div><span>03</span><h3>She makes the final call.</h3><p>Only entries made before the recorded birth time count. The organizer closes the pool and handles contributions, payouts, and any late-entry refunds. All dates use Berlin time.</p></div></div></section>
    <details className="organizer-section"><summary><LockKeyhole size={15}/> Organizer corner</summary>{closed?<p className="muted">The pool is closed. Arrival recorded for {dateLabel(pool!.arrivalDate!)} at {new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'}).format(new Date(pool!.arrivalAt!))} Berlin time.</p>:<div className="organizer-form"><p className="muted">When the family shares the news, enter the actual birth time. This closes entries and calculates the winners.</p><div className="organizer-inputs"><label htmlFor="organizer-code">Organizer code<input id="organizer-code" type="password" autoComplete="off" value={organizerCode} onChange={e=>setOrganizerCode(e.target.value)}/></label><label htmlFor="arrival-time">Arrival date & time · Berlin<input id="arrival-time" type="datetime-local" min={`${DUE_DATE}T00:00`} value={arrivalLocal} onChange={e=>setArrivalLocal(e.target.value)}/></label></div><AlertDialog><AlertDialogTrigger asChild><button className="secondary-button" disabled={!organizerCode||!arrivalLocal||adminBusy}>{adminBusy?'Recording the arrival…':'Record arrival & close the pool'}</button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Welcome her and close the pool?</AlertDialogTitle><AlertDialogDescription>Record the birth as {arrivalLocal.replace('T',' at ')} Berlin time. New guesses will stop, and entries made at or after that time will be excluded. This cannot be changed here.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Check the time</AlertDialogCancel><AlertDialogAction onClick={()=>void closePool()}>Confirm arrival</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>{adminError&&<p className="form-error" role="alert">{adminError}</p>}</div>}</details>
    </main><footer><span>Made with love for the Habermann family.</span><Heart size={17}/><span>She&apos;ll arrive when she&apos;s ready.</span></footer>
  </div>;
}
