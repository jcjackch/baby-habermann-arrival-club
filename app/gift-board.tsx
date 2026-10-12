'use client';
import { siteFetch } from '@/lib/api-client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, ExternalLink, Gift, Plus, RefreshCw, Shirt } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { FIRST_GIFT, validateGiftSuggestion, type GiftSuggestion } from '@/lib/gifts';
import { FIRST_GIFT_OPTION, giftOption } from '@/lib/votes';
import { UpvoteButton } from './upvotes';

function mergeSuggestions(current: GiftSuggestion[], incoming: GiftSuggestion[]) {
  const byId = new Map(current.map(gift => [gift.id, gift]));
  incoming.forEach(gift => byId.set(gift.id, gift));
  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

export default function GiftBoard() {
  const [suggestions, setSuggestions] = useState<GiftSuggestion[]>([]);
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState('');
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [title, setTitle] = useState(''), [url, setUrl] = useState(''), [note, setNote] = useState(''), [addedBy, setAddedBy] = useState('');
  const [savedTitle, setSavedTitle] = useState('');
  const draftId = useRef<string | null>(null);
  const submitting = useRef(false);

  async function refresh() {
    try {
      const response = await siteFetch('/api/gifts', { cache: 'no-store' });
      const data = await response.json() as { suggestions: GiftSuggestion[]; error?: string };
      if (!response.ok) throw new Error(data.error || 'Gift suggestions could not be loaded.');
      setSuggestions(current => mergeSuggestions(current, data.suggestions));
      setLoadError('');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Gift suggestions could not be loaded.');
    } finally { setLoading(false); }
  }
  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 30000);
    return () => clearInterval(interval);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    setError('');
    draftId.current ??= crypto.randomUUID();
    let payload;
    try { payload = validateGiftSuggestion({ id: draftId.current, title, url, note, addedBy }); }
    catch (error) { setError((error as Error).message); return; }
    submitting.current = true;
    setBusy(true);
    try {
      const response = await siteFetch('/api/gifts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json() as { suggestion: GiftSuggestion; error?: string };
      if (!response.ok) throw new Error(data.error || 'Your gift could not be saved.');
      setSuggestions(current => mergeSuggestions(current, [data.suggestion]));
      setSavedTitle(data.suggestion.title);
      setTitle(''); setUrl(''); setNote(''); setAddedBy(''); draftId.current = null;
      setOpen(false);
      toast.success('Gift idea added to the shared list.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save your suggestion. Please try again.');
    } finally { submitting.current = false; setBusy(false); }
  }

  return <section className="celebration-panel gift-panel" id="gifts" aria-labelledby="gift-heading">
    <div className="celebration-heading"><span className="eyebrow">LITTLE GIFTS, BIG LOVE</span><Gift size={25} aria-hidden="true"/></div>
    <h2 id="gift-heading">Something for the little ones.</h2>
    <p className="bakery-menu-intro">A shared wish list for the kids. Add a thoughtful find, a shop link, or a little note.</p>
    <article className="gift-card featured-gift">
      <div className="gift-feature-art" aria-hidden="true"><span>WELCOME TO THE TEAM</span><Shirt size={92} strokeWidth={1.1}/><b>NEUZUGANG</b><small>SV ELVERSBERG</small></div>
      <div className="gift-card-body"><span className="gift-kicker">OUR FIRST GIFT IDEA</span><h3>{FIRST_GIFT.title}</h3><p>{FIRST_GIFT.note}</p><a className="gift-shop-link" href={FIRST_GIFT.url} target="_blank" rel="noopener noreferrer">View in the club shop <ExternalLink size={14}/></a><p className="gift-price-note">See the shop for current price, sizes, and availability.</p><div className="gift-vote-row"><UpvoteButton optionId={FIRST_GIFT_OPTION} label={FIRST_GIFT.title}/></div></div>
    </article>
    <Dialog open={open} onOpenChange={value => { if (!submitting.current) { setOpen(value); if (value) setError(''); } }}>
      <DialogTrigger asChild><button className="primary-button add-gift-button"><Plus size={18}/> Add a gift idea</button></DialogTrigger>
      <DialogContent className="gift-dialog" showCloseButton={!busy} onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => { if (busy) event.preventDefault(); }}>
        <DialogHeader><DialogTitle>Add a little something.</DialogTitle><DialogDescription>Your suggestion will appear as a text card for everyone with access to this page.</DialogDescription></DialogHeader>
        <form onSubmit={submit}>
          <fieldset disabled={busy} className="gift-form-fields">
            <label htmlFor="gift-title">Gift name<input id="gift-title" required minLength={2} maxLength={100} value={title} onChange={event => setTitle(event.target.value)}/></label>
            <label htmlFor="gift-url">Shop link <span className="optional-label">optional</span><input id="gift-url" type="url" maxLength={1000} placeholder="https://" value={url} onChange={event => setUrl(event.target.value)}/></label>
            <label htmlFor="gift-note">A little note <span className="optional-label">optional</span><textarea id="gift-note" rows={3} maxLength={400} value={note} onChange={event => setNote(event.target.value)}/></label>
            <label htmlFor="gift-author">Your name <span className="optional-label">optional</span><input id="gift-author" autoComplete="name" maxLength={50} value={addedBy} onChange={event => setAddedBy(event.target.value)}/></label>
            <div className="gift-form-actions"><button className="secondary-button" type="button" onClick={() => setOpen(false)}>Cancel</button><button className="primary-button" type="submit">{busy ? 'Adding your idea…' : 'Add to the gift list'}</button></div>
          </fieldset>
          {error && <p className="form-error" role="alert">{error}</p>}
        </form>
      </DialogContent>
    </Dialog>
    <p className="gift-save-message" role="status">{savedTitle && <><Check size={15}/> “{savedTitle}” was added to the shared list.</>}</p>
    <div className="gift-list-heading"><h3>Everyone&apos;s gift ideas</h3><span className="count-pill">{suggestions.length + 1} {suggestions.length ? 'ideas' : 'idea'}</span></div>
    {loadError && <div className="gift-load-error" role="alert"><p>{loadError}</p><button type="button" onClick={() => void refresh()}><RefreshCw size={14}/> Try again</button></div>}
    {loading && <p className="gift-list-note" role="status">Loading shared gift ideas…</p>}
    {!loading && !loadError && !suggestions.length && <div className="gift-empty"><Gift size={23} aria-hidden="true"/><p>What would make a lovely welcome?<br/><span>Add the next idea to our little collection.</span></p></div>}
    <div className="gift-suggestions">{suggestions.map(gift => <article className="gift-card suggested-gift" key={gift.id}>
      <div className="gift-suggestion-icon"><Gift size={19} aria-hidden="true"/></div><div className="gift-suggestion-text"><h3>{gift.title}</h3>{gift.note && <p className="gift-note">{gift.note}</p>}{gift.url && <a className="gift-shop-link" href={gift.url} target="_blank" rel="noopener noreferrer ugc">View gift <ExternalLink size={13}/></a>}<p className="gift-credit">{gift.addedBy ? `Suggested by ${gift.addedBy}` : 'A gift idea from the club'}</p><div className="gift-vote-row"><UpvoteButton optionId={giftOption(gift.id)} label={gift.title}/></div></div>
    </article>)}</div>
    <p className="fine-print gift-fund-note">Gift ideas are collected separately from the cake fund. The pool stays 50% for the winner and 50% for the birthday cake. Adding an idea does not buy or reserve it.</p>
  </section>;
}
