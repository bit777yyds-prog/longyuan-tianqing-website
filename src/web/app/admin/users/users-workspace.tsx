'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, UserRoundCheck, UserRoundX } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { invitationRoleLabels } from '@/lib/fixtures/invitations';

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'project_owner' | 'reviewer' | 'participant';
  status: 'active' | 'disabled' | 'invited';
  lastSeenAt: string | null;
  joinedAt: string;
};

const roleOptions = [
  { value: 'all', label: '全部角色' },
  { value: 'admin', label: '管理员' },
  { value: 'project_owner', label: '项目负责人' },
  { value: 'reviewer', label: '验收者' },
  { value: 'participant', label: '参与者' },
];

const statusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'active', label: '正常' },
  { value: 'invited', label: '待激活' },
  { value: 'disabled', label: '已停用' },
];

export function UsersWorkspace() {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    fetch('/api/users')
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? '用户列表加载失败');
        if (active) setUsers(payload.users);
      })
      .catch((caught) => active && setError(caught instanceof Error ? caught.message : '用户列表加载失败'))
      .finally(() => active && setIsLoading(false));
    return () => { active = false; };
  }, []);

  const filteredUsers = useMemo(() => users.filter((user) => {
    const term = query.trim().toLowerCase();
    const matchesQuery = user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term);
    return matchesQuery && (role === 'all' || user.role === role) && (status === 'all' || user.status === status);
  }), [query, role, status, users]);

  async function toggleUser(user: UserRow) {
    const nextStatus = user.status === 'active' ? 'disabled' : 'active';
    setError(undefined);
    setUpdatingId(user.id);
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(user.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? '账号状态更新失败');
      setUsers((current) => current.map((item) => item.id === user.id
        ? { ...item, status: nextStatus }
        : item));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '账号状态更新失败');
    } finally {
      setUpdatingId(undefined);
    }
  }

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-text md:text-3xl">用户管理</h1>
          <p className="mt-2 text-sm text-text-muted">查看账号状态、角色与最近活动。</p>
        </div>
      </div>

      <section className="grid gap-3 py-6 sm:grid-cols-3" aria-label="用户概览">
        <Summary label="全部用户" value={users.length} />
        <Summary label="正常账号" value={users.filter((user) => user.status === 'active').length} />
        <Summary label="管理员与负责人" value={users.filter((user) => user.role === 'admin' || user.role === 'project_owner').length} />
      </section>

      <section className="border-t border-border pt-5">
        {error && <p className="mb-4 border border-kiln-500 bg-kiln-100 px-3 py-2 text-sm text-status-risk" role="alert">{error}</p>}
        <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_180px_180px_auto] md:items-end">
          <label className="relative block">
            <span className="sr-only">搜索用户</span>
            <Search size={16} className="pointer-events-none absolute left-3 top-3 text-text-muted" aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索姓名或邮箱" className="w-full rounded-sm border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-celadon-700" />
          </label>
          <Select label="角色" className="[&>label]:sr-only" options={roleOptions} value={role} onChange={(event) => setRole(event.target.value)} />
          <Select label="状态" className="[&>label]:sr-only" options={statusOptions} value={status} onChange={(event) => setStatus(event.target.value)} />
          <p className="pb-2 text-right text-sm text-text-muted">{filteredUsers.length} 位用户</p>
        </div>

        <div className="mt-4 overflow-x-auto border-y border-border bg-surface">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead className="bg-bg text-xs text-text-muted"><tr>
              <th className="px-4 py-3 font-medium">用户</th><th className="px-4 py-3 font-medium">角色</th>
              <th className="px-4 py-3 font-medium">状态</th><th className="px-4 py-3 font-medium">最近活动</th>
              <th className="px-4 py-3 font-medium">加入日期</th><th className="px-4 py-3 text-right font-medium">操作</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-bg/70">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-celadon-100 text-xs font-semibold text-celadon-900" aria-hidden="true">{user.name.slice(0, 1)}</span>
                      <div><p className="font-medium text-text">{user.name}</p><p className="text-xs text-text-muted">{user.email}</p></div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-muted">{invitationRoleLabels[user.role]}</td>
                  <td className="px-4 py-3"><StatusBadge status={user.status} /></td>
                  <td className="px-4 py-3 text-text-muted">{formatLastSeen(user.lastSeenAt)}</td>
                  <td className="px-4 py-3 text-text-muted">{formatDate(user.joinedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" disabled={updatingId === user.id} className="rounded-sm p-2 text-text-muted hover:bg-bg hover:text-text disabled:cursor-wait disabled:opacity-40" aria-label={user.status === 'active' ? `停用 ${user.name}` : `启用 ${user.name}`} onClick={() => toggleUser(user)}>
                        {user.status === 'active' ? <UserRoundX size={16} /> : <UserRoundCheck size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {isLoading && <tr><td colSpan={6} className="px-4 py-10 text-center text-text-muted">正在加载用户...</td></tr>}
              {!isLoading && filteredUsers.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-text-muted">暂无符合条件的用户</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="border border-border bg-surface px-4 py-3"><p className="text-xs text-text-muted">{label}</p><p className="mt-1 text-2xl font-semibold text-text">{value}</p></div>;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(value));
}

function formatLastSeen(value: string | null): string {
  if (!value) return '尚无活动';
  const elapsedMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(elapsedMs / 60_000));
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return formatDate(value);
}
