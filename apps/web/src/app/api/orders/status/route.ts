import { proxyErrorResponse, proxyToApi } from '../../_lib/proxy';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username') ?? '';

    return await proxyToApi(
      `/api/orders/status?username=${encodeURIComponent(username)}`,
    );
  } catch (error) {
    return proxyErrorResponse(error);
  }
}
