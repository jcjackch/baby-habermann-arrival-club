'use client';
import { siteFetch } from '@/lib/api-client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUp, RefreshCw } from 'lucide-react';
import type { VoteCounts } from '@/lib/votes';

type VotingContext = {
  votes: VoteCounts | null;
  pending: string | null;
  error: string;
  refresh: () => Promise<void>;
  toggle: (optionId: string) => Promise<void>;
};
const Context = createContext<VotingContext | null>(null);

export function UpvoteProvider({ children }: { children: ReactNode }) {
  const [votes, setVotes] = useState<VoteCounts | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState('');
  const busy = useRef(false), requestSequence = useRef(0);

  async function refresh() {
    if (busy.current) return;
    const sequence = ++requestSequence.current;
    try {
      const response = await siteFetch('/api/votes', { cache: 'no-store' });
      const data = await response.json() as { votes: VoteCounts; error?: string };
      if (!response.ok) throw new Error(data.error || 'Upvotes could not be loaded.');
      if (sequence === requestSequence.current) { setVotes(data.votes); setError(''); }
    } catch (error) {
      if (sequence === requestSequence.current) setError(error instanceof Error ? error.message : 'Upvotes could not be loaded.');
    }
  }
  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 30000);
    return () => { clearInterval(interval); ++requestSequence.current; };
  }, []);

  async function toggle(optionId: string) {
    if (!votes || busy.current) return;
    busy.current = true;
    ++requestSequence.current;
    setPending(optionId); setError('');
    try {
      const response = await siteFetch('/api/votes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ optionId, upvoted: !votes[optionId]?.upvoted }) });
      const data = await response.json() as { votes: VoteCounts; error?: string };
      if (!response.ok) throw new Error(data.error || 'Your upvote could not be saved.');
      setVotes(data.votes);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Your upvote could not be saved.');
    } finally { busy.current = false; setPending(null); }
  }

  return <Context.Provider value={{ votes, pending, error, refresh, toggle }}>{children}</Context.Provider>;
}

export function UpvoteHelp() {
  const context = useContext(Context)!;
  return <div className="upvote-help"><p><strong>Give your favorites a little love.</strong> Upvote cake as one option, or any gift you like. One upvote per option in this browser; tap again to undo.</p>{context.error && <div className="upvote-error" role="alert"><span>{context.error}</span><button type="button" disabled={!!context.pending} onClick={() => void context.refresh()}><RefreshCw size={14}/> Refresh upvotes</button></div>}</div>;
}

export function UpvoteButton({ optionId, label }: { optionId: string; label: string }) {
  const { votes, pending, toggle } = useContext(Context)!;
  const vote = votes?.[optionId], selected = !!vote?.upvoted;
  const count = votes ? vote?.count ?? 0 : null;
  return <button type="button" className={`upvote-button${selected ? ' is-upvoted' : ''}`} aria-pressed={selected} aria-busy={pending === optionId} aria-label={`${selected ? 'Remove your upvote for' : 'Upvote'} ${label}${count === null ? ', loading votes' : `, ${count} ${count === 1 ? 'vote' : 'votes'}`}`} disabled={!votes || !!pending} onClick={() => void toggle(optionId)}><ArrowUp size={17} strokeWidth={2.5}/><span>{pending === optionId ? 'Saving…' : selected ? 'Upvoted' : 'Upvote'}</span><strong aria-live="polite">{count ?? '—'}</strong></button>;
}
