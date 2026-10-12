export const PAGES_ORIGIN = 'https://jcjackch.github.io';
const visitorPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export function pagesVisitor(request: Request): string | null {
  if (request.headers.get('origin') !== PAGES_ORIGIN) return null;
  const visitor = request.headers.get('x-arrival-visitor');
  return visitor && visitorPattern.test(visitor) ? visitor : null;
}

export function trustedOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !!origin && (origin === new URL(request.url).origin || origin === PAGES_ORIGIN);
}

export function withCors(handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    const response = await handler(request);
    if (request?.headers.get('origin') !== PAGES_ORIGIN) return response;
    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', PAGES_ORIGIN);
    headers.append('Vary', 'Origin');
    // GitHub Pages uses its own visitor ID, never third-party cookies.
    headers.delete('Set-Cookie');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  };
}

export function OPTIONS(request: Request) {
  if (request.headers.get('origin') !== PAGES_ORIGIN) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': PAGES_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Arrival-Visitor',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin',
  } });
}
