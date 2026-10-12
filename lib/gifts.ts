export type GiftSuggestion = {
  id: string;
  title: string;
  url: string;
  note: string;
  addedBy: string;
  createdAt: string;
};

export const FIRST_GIFT = {
  title: 'SV Elversberg Baby-Body “Neuzugang”',
  url: 'https://www.merchandising-onlineshop.com/sv07elversberg/baby-body-neuzugang-1907-7013.html',
  note: 'A little welcome for the newest member of the team.',
};

export function validateGiftSuggestion(input: unknown): Omit<GiftSuggestion, 'createdAt'> {
  if (!input || typeof input !== 'object') throw new Error('Please check your gift suggestion.');
  const value = input as Record<string, unknown>;
  if (typeof value.id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value.id)) {
    throw new Error('Please reopen the gift form and try again.');
  }
  const field = (key: string, max: number, label: string) => {
    if (value[key] !== undefined && typeof value[key] !== 'string') throw new Error(`Please check ${label}.`);
    const text = (value[key] as string | undefined)?.trim() ?? '';
    if (text.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
    return text;
  };
  const title = field('title', 100, 'The gift name');
  if (title.length < 2) throw new Error('Give your gift a name of at least 2 characters.');
  const note = field('note', 400, 'The note');
  const addedBy = field('addedBy', 50, 'Your name');
  let url = field('url', 1000, 'The shop link');
  if (url) {
    try {
      const parsed = new URL(url);
      if (!/^https?:\/\//i.test(url) || !['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password || /[\u0000-\u0020\u007f]/.test(url)) throw new Error();
      url = parsed.href;
    } catch {
      throw new Error('Use a complete http:// or https:// shop link, or leave it blank.');
    }
  }
  return { id: value.id, title, url, note, addedBy };
}
