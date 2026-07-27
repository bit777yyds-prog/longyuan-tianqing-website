import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RegisterForm } from './register-form';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RegisterForm', () => {
  it('submits the invitation token and account details', async () => {
    const fetchMock = vi.fn(async (_input: string, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({ user: { email: 'user@example.com' } }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    render(<RegisterForm initialToken="invite-token" />);

    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('显示名称'), { target: { value: 'Long Yuan User' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'Longyuan2026Pass' } });
    fireEvent.click(screen.getByRole('button', { name: '创建账号' }));

    expect(await screen.findByText('账号创建成功')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();
    const request = fetchMock.mock.calls[0]?.[1];
    expect(request).toBeDefined();
    expect(JSON.parse(String(request?.body))).toEqual({
      token: 'invite-token',
      email: 'user@example.com',
      displayName: 'Long Yuan User',
      password: 'Longyuan2026Pass',
    });
  });

  it('shows API errors without clearing the form', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      json: async () => ({ error: '邀请无效、已过期或与邮箱不匹配' }),
    })));
    render(<RegisterForm initialToken="bad-token" />);

    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('显示名称'), { target: { value: 'Long Yuan User' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'Longyuan2026Pass' } });
    fireEvent.click(screen.getByRole('button', { name: '创建账号' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('邀请无效');
    expect(screen.getByLabelText('邀请令牌')).toHaveValue('bad-token');
  });
});
