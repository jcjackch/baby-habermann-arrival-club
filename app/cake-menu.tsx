import { CakeSlice, Check } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { BAKERY, CAKES, euros } from '@/lib/pool';
import { CAKE_OPTION } from '@/lib/votes';
import { UpvoteButton } from './upvotes';

export default function CakeMenu({ budget }: { budget: number | null }) {
  const nextCake = CAKES.find(cake => cake.cents > (budget ?? 0));
  const bestCake = [...CAKES].reverse().find(cake => budget !== null && cake.cents <= budget);
  return <section className="celebration-panel cake-menu" id="cakes" aria-labelledby="cake-heading">
    <div className="celebration-heading"><span className="eyebrow">FROM A SAARBRÜCKEN BAKERY</span><CakeSlice size={25} aria-hidden="true"/></div>
    <h2 id="cake-heading">A cake worth celebrating.</h2>
    <p className="bakery-menu-intro">Real whole cakes from {BAKERY.name}, ranked by published menu price.</p>
    <div className="cake-upvote"><span>Cake · one sweet option</span><UpvoteButton optionId={CAKE_OPTION} label="Cake"/></div>
    <div className="local-bakery"><div className="cake-photo bakery-illustration" aria-hidden="true"><CakeSlice size={56} strokeWidth={1.2}/><span>Something sweet</span></div><div className="local-bakery-info"><h3><a href={BAKERY.website} target="_blank" rel="noopener noreferrer">{BAKERY.name}</a></h3><p>{BAKERY.address}</p><a href={BAKERY.phoneHref}>{BAKERY.phone}</a><a className="cake-source" href={BAKERY.menuUrl} target="_blank" rel="noopener noreferrer">Official cake menu (PDF)</a></div></div>
    <div className="cake-budget"><span>Cake budget <strong>{budget === null ? '—' : euros(budget)}</strong></span><span className="budget-tag">50% of every pledge</span></div>
    <p className="afford-summary">{budget === null ? 'Loading the cake fund…' : bestCake ? <>We can plan for <strong>{bestCake.name}</strong>.</> : <>First goal: {CAKES[0].name} at {euros(CAKES[0].cents)}.</>}</p>
    {CAKES.map((cake, i) => {
      const affordable = budget !== null && cake.cents <= budget;
      return <div className={`cake-row ${affordable ? 'affordable' : ''}`} key={cake.name}><span className="cake-rank">0{i + 1}</span><div className="cake-details"><h3>{cake.name}</h3><p>{cake.detail}</p><a className="cake-source" href={cake.sourceUrl} target="_blank" rel="noopener noreferrer">Café Lolo menu · page {cake.menuPage}</a><span className="cake-status">{affordable ? <><Check size={13}/> Within budget</> : budget !== null ? `${euros(cake.cents - budget)} more for cake` : 'Awaiting pool total'}</span></div><strong>{euros(cake.cents).replace('.00', '')}</strong></div>;
    })}
    {budget !== null && nextCake && <div className="next-cake"><div><span>Next cake: {nextCake.name}</span><strong>{Math.floor(budget / nextCake.cents * 100)}%</strong></div><Progress value={Math.min(100, budget / nextCake.cents * 100)} aria-label={`Progress toward ${nextCake.name}`}/><p>{euros((nextCake.cents - budget) * 2)} more in total pledges unlocks this cake.</p></div>}
    <p className="fine-print">Published menu checked {BAKERY.checkedOn}. Confirm availability and final price with Café Lolo before ordering. Delivery and extra decoration are not included. Pledges must be collected first.</p>
  </section>;
}
