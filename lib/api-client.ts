const apiBase = typeof __ARRIVAL_API_URL__ === 'string' ? __ARRIVAL_API_URL__.replace(/\/$/, '') : '';
const visitorKey = 'arrival-club-visitor-v1';

function visitorId() {
  try {
    let id = localStorage.getItem(visitorKey);
    if (!id || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)) {
      id = crypto.randomUUID();
      localStorage.setItem(visitorKey, id);
    }
    return id;
  } catch {
    throw new Error('Please allow browser storage for this site so we can remember your guess and upvotes.');
  }
}

export function siteFetch(path: string, init: RequestInit = {}) {
  if (!apiBase) return fetch(path, init);
  const headers = new Headers(init.headers);
  headers.set('X-Arrival-Visitor', visitorId());
  return fetch(`${apiBase}${path}`, { ...init, headers, credentials: 'omit' });
}
