import { getAuth } from '@/server/auth/auth';

export const dynamic = 'force-dynamic';

async function handle(request: Request): Promise<Response> {
  try {
    return await getAuth().handler(request);
  } catch (error) {
    console.error('Authentication request failed', {
      type: error instanceof Error ? error.name : typeof error,
    });
    return Response.json({ error: '认证服务尚未配置或暂时不可用' }, { status: 503 });
  }
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
