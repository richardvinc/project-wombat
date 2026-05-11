type ProxyInit = {
  method?: 'GET' | 'POST';
  body?: unknown;
};

function getApiBaseUrl(): string {
  const internalApi = process.env.API_INTERNAL_URL;
  const apiPort = process.env.API_PORT ?? '3100';

  if (internalApi) {
    return internalApi.replace(/\/$/, '');
  }

  return `http://localhost:${apiPort}`;
}

export async function proxyToApi(
  path: string,
  init: ProxyInit = {},
): Promise<Response> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: init.method ?? 'GET',
    headers:
      init.body === undefined ? undefined : { 'content-type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
  });

  const body = await response.text();

  return new Response(body, {
    status: response.status,
    headers: { 'content-type': 'application/json' },
  });
}

export function proxyErrorResponse(error: unknown): Response {
  return new Response(JSON.stringify({ error: String(error) }), {
    status: 502,
    headers: { 'content-type': 'application/json' },
  });
}
