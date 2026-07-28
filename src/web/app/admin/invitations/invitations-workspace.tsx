'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Check, Copy, MailPlus, Search, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { invitationRoleLabels, roleOptions } from '@/lib/fixtures/invitations';

type InvitationStatus = 'active' | 'used' | 'revoked' | 'expired';
type InvitationRow = {
  id: string;
  invitedEmail: string;
  invitedRole: string;
  status: InvitationStatus;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
};

const statusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'active', label: '有效' },
  { value: 'used', label: '已使用' },
  { value: 'revoked', label: '已撤销' },
  { value: 'expired', label: '已过期' },
];

const statusKinds: Record<InvitationStatus, string> = {
  active: 'valid_invitation', used: 'used_invitation', revoked: 'revoked_invitation', expired: 'expired_invitation',
};

export function InvitationsWorkspace() {
  const [rows, setRows] = useState<InvitationRow[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string>();
  const [copiedId, setCopiedId] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    fetch('/api/invitations')
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? '邀请列表加载失败');
        if (active) setRows(payload.invitations);
      })
      .catch((caught) => active && setError(caught instanceof Error ? caught.message : '邀请列表加载失败'))
      .finally(() => active && setIsLoading(false));
    return () => { active = false; };
  }, []);

  const filteredRows = useMemo(() => rows.filter((row) => {
    const matchesQuery = row.invitedEmail.toLowerCase().includes(query.trim().toLowerCase());
    return matchesQuery && (status === 'all' || row.status === status);
  }), [query, rows, status]);

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsSubmitting(true);
    const data = new FormData(event.currentTarget);
    try {
      const expiresAt = new Date(`${String(data.get('expiresAt'))}T23:59:59`);
      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: data.get('email'),
          role: data.get('role'),
          expiresAt: expiresAt.toISOString(),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? '邀请创建失败');
      setRows((current) => [payload.invitation, ...current]);
      setGeneratedLink(`${window.location.origin}/register?token=${payload.rawToken}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '邀请创建失败');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copyText(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(undefined), 1600);
  }

  async function revokeInvitation(id: string) {
    setError(undefined);
    try {
      const response = await fetch(`/api/invitations/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? '撤销邀请失败');
      }
      setRows((current) => current.map((row) => row.id === id ? { ...row, status: 'revoked' } : row));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '撤销邀请失败');
    }
  }

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-text md:text-3xl">邀请管理</h1>
          <p className="mt-2 text-sm text-text-muted">创建限定邮箱与角色的一次性注册链接。</p>
        </div>
        <Button type="button" size="sm" className="gap-2" onClick={() => { setGeneratedLink(undefined); setDialogOpen(true); }}>
          <MailPlus size={16} aria-hidden="true" />新建邀请
        </Button>
      </div>

      <section className="grid gap-3 py-6 sm:grid-cols-3" aria-label="邀请概览">
        <Summary label="有效邀请" value={rows.filter((row) => row.status === 'active').length} />
        <Summary label="已完成注册" value={rows.filter((row) => row.status === 'used').length} />
        <Summary label="已撤销或过期" value={rows.filter((row) => row.status === 'revoked' || row.status === 'expired').length} />
      </section>

      <section className="border-t border-border pt-5">
        {error && <p className="mb-4 border border-kiln-500 bg-kiln-100 px-3 py-2 text-sm text-status-risk" role="alert">{error}</p>}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid flex-1 gap-3 sm:max-w-xl sm:grid-cols-[1fr_180px]">
            <label className="relative block">
              <span className="sr-only">搜索邮箱</span>
              <Search size={16} className="pointer-events-none absolute left-3 top-3 text-text-muted" aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索受邀邮箱"
                className="w-full rounded-sm border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-celadon-700"
              />
            </label>
            <Select label="状态" className="[&>label]:sr-only" options={statusOptions} value={status} onChange={(event) => setStatus(event.target.value)} />
          </div>
          <p className="text-sm text-text-muted">{filteredRows.length} 条记录</p>
        </div>

        <div className="mt-4 overflow-x-auto border-y border-border bg-surface">
          <table className="w-full min-w-[840px] border-collapse text-left text-sm">
            <thead className="bg-bg text-xs text-text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">受邀邮箱</th><th className="px-4 py-3 font-medium">角色</th>
                <th className="px-4 py-3 font-medium">状态</th><th className="px-4 py-3 font-medium">创建人</th>
                <th className="px-4 py-3 font-medium">创建日期</th><th className="px-4 py-3 font-medium">过期日期</th>
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRows.map((row) => (
                <tr key={row.id} className="hover:bg-bg/70">
                  <td className="px-4 py-3 font-medium text-text">{row.invitedEmail}</td>
                  <td className="px-4 py-3 text-text-muted">{invitationRoleLabels[row.invitedRole]}</td>
                  <td className="px-4 py-3"><StatusBadge status={statusKinds[row.status]} /></td>
                  <td className="px-4 py-3 text-text-muted">{row.createdBy}</td>
                  <td className="px-4 py-3 text-text-muted">{formatDate(row.createdAt)}</td>
                  <td className="px-4 py-3 text-text-muted">{formatDate(row.expiresAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" className="rounded-sm p-2 text-text-muted hover:bg-celadon-100 hover:text-celadon-900" aria-label={`复制邮箱 ${row.invitedEmail}`} onClick={() => copyText(row.invitedEmail, row.id)}>
                        {copiedId === row.id ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                      <button type="button" disabled={row.status !== 'active'} className="rounded-sm p-2 text-text-muted hover:bg-kiln-100 hover:text-status-risk disabled:cursor-not-allowed disabled:opacity-30" aria-label={`撤销 ${row.invitedEmail} 的邀请`} onClick={() => revokeInvitation(row.id)}>
                        <XCircle size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && filteredRows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-text-muted">暂无符合条件的邀请</td></tr>
              )}
              {isLoading && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-text-muted">正在加载邀请...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="新建邀请" description="邀请链接仅在生成后显示一次。">
        {generatedLink ? (
          <div>
            <label className="text-sm font-medium text-text" htmlFor="generated-link">注册链接</label>
            <div className="mt-2 flex gap-2">
              <input id="generated-link" readOnly value={generatedLink} className="min-w-0 flex-1 rounded-sm border border-border bg-bg px-3 py-2 text-sm text-text" />
              <Button type="button" variant="secondary" aria-label="复制注册链接" onClick={() => copyText(generatedLink, 'generated')}>
                {copiedId === 'generated' ? <Check size={16} /> : <Copy size={16} />}
              </Button>
            </div>
            <Button type="button" className="mt-5" onClick={() => setDialogOpen(false)}>完成</Button>
          </div>
        ) : (
          <form className="grid gap-4" onSubmit={createInvitation}>
            <Input label="邮箱" name="email" type="email" placeholder="name@example.com" required />
            <Select label="角色" name="role" options={roleOptions} defaultValue="participant" required />
            <Input label="有效期至" name="expiresAt" type="date" defaultValue={defaultExpiryDate()} required />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>取消</Button>
              <Button type="submit" isLoading={isSubmitting}>生成链接</Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="border border-border bg-surface px-4 py-3"><p className="text-xs text-text-muted">{label}</p><p className="mt-1 text-2xl font-semibold text-text">{value}</p></div>;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(value));
}

function defaultExpiryDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}
