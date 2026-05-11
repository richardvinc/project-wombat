import { proxyErrorResponse, proxyToApi } from '../../_lib/proxy';

export async function GET() {
  try {
    return await proxyToApi('/api/flash-sale/status');
  } catch (error) {
    return proxyErrorResponse(error);
  }
}
