import { NextResponse } from 'next/server';
import { RegistrationService } from '@/server/domain/registration-service';
import { createDatabaseClient, DatabaseConfigurationError } from '@/server/db/client';
import { SqlRegistrationRepository } from '@/server/db/registration-repository';
import { InvalidRequestError, parseRegisterRequest } from '@/server/http/register-request';

export async function POST(request: Request) {
  try {
    assertBodySize(request);
    const body = await readJsonBody(request);
    const input = parseRegisterRequest(body);
    const repository = new SqlRegistrationRepository(createDatabaseClient());
    const registered = await new RegistrationService(repository).registerWithInvitation(input);

    return NextResponse.json({ user: registered }, { status: 201 });
  } catch (error) {
    const response = mapRegistrationError(error);
    if (response.status === 500) {
      console.error('Registration failed', { type: error instanceof Error ? error.name : typeof error });
    }
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}

function assertBodySize(request: Request): void {
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > 16_384) {
    throw new InvalidRequestError('Request body is too large');
  }
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new InvalidRequestError('Request body must be valid JSON');
  }
}

function mapRegistrationError(error: unknown): { status: number; message: string } {
  if (error instanceof InvalidRequestError) return { status: 400, message: '请求参数不完整或格式错误' };
  if (error instanceof DatabaseConfigurationError) {
    return { status: 503, message: '注册服务尚未配置' };
  }
  if (isPostgresError(error) && error.code === '23505') {
    return { status: 409, message: '该邮箱已经注册' };
  }
  if (error instanceof Error && isClientRegistrationError(error.message)) {
    if (error.message.startsWith('Display name')) return { status: 400, message: '显示名称不能为空' };
    if (error.message.startsWith('Password must')) {
      return { status: 400, message: '密码至少 12 位，并包含大小写字母和数字' };
    }
    return { status: 400, message: '邀请无效、已过期或与邮箱不匹配' };
  }
  return { status: 500, message: '注册失败，请稍后重试' };
}

function isPostgresError(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string';
}

function isClientRegistrationError(message: string): boolean {
  return [
    'Display name',
    'Password must',
    'Invitation not',
    'Invitation is',
    'Invitation has expired',
    'Invitation email',
  ].some((prefix) => message.startsWith(prefix));
}
