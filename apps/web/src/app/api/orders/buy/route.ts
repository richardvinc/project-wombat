import { proxyErrorResponse, proxyToApi } from '../../_lib/proxy';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return await proxyToApi('/api/orders/buy', { method: 'POST', body });
  } catch (error) {
    return proxyErrorResponse(error);
  }
}
