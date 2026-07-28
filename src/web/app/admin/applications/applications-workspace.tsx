'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';

type TaskApplicationRow = {
  id: string;
  taskId: string;
  taskTitle: string;
  applicantName: string;
  applicantEmail: string;
  status: string;
  message: string;
  createdAt: string;
};

export function ApplicationsWorkspace() {
  const [applications, setApplications] = useState<TaskApplicationRow[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [actionApplicationId, setActionApplicationId] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    fetch('/api/task-applications')
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? '申请列表加载失败');
        if (active) setApplications(payload.applications);
      })
      .catch((caught) => active && setError(caught instanceof Error ? caught.message : '申请列表加载失败'))
      .finally(() => active && setIsLoading(false));
    return () => { active = false; };
  }, []);

  const filteredApplications = useMemo(() => applications.filter((application) => {
    const term = query.trim().toLowerCase();
    return (
      application.taskTitle.toLowerCase().includes(term)
      || application.applicantName.toLowerCase().includes(term)
      || application.applicantEmail.toLowerCase().includes(term)
    );
  }), [applications, query]);

  async function decideApplication(applicationId: string, decision: 'accepted' | 'rejected') {
    setError(undefined);
    setActionApplicationId(applicationId);
    try {
      const response = await fetch(`/api/task-applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? '申请处理失败');
      setApplications((current) => current.map((application) => (
        application.id === applicationId ? payload.application : application
      )));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '申请处理失败');
    } finally {
      setActionApplicationId(undefined);
    }
  }

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="border-b border-border pb-6">
        <h1 className="font-serif text-2xl font-semibold text-text md:text-3xl">申请管理</h1>
        <p className="mt-2 text-sm text-text-muted">查看开放任务收到的申请，后续可在这里接入通过、驳回和分配。</p>
      </div>

      <section className="grid gap-3 py-6 sm:grid-cols-3" aria-label="申请概览">
        <Summary label="全部申请" value={applications.length} />
        <Summary label="待处理" value={applications.filter((item) => item.status === 'submitted').length} />
        <Summary label="涉及任务" value={new Set(applications.map((item) => item.taskId)).size} />
      </section>

      <section className="border-t border-border pt-5">
        {error && <p className="mb-4 border border-kiln-500 bg-kiln-100 px-3 py-2 text-sm text-status-risk" role="alert">{error}</p>}
        <label className="relative block max-w-xl">
          <span className="sr-only">搜索申请</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-3 text-text-muted" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索任务、申请人或邮箱"
            className="w-full rounded-sm border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-celadon-700"
          />
        </label>

        <div className="mt-4 overflow-x-auto border-y border-border bg-surface">
          <table className="w-full min-w-[960px] border-collapse text-left text-sm">
            <thead className="bg-bg text-xs text-text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">任务</th>
                <th className="px-4 py-3 font-medium">申请人</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">申请说明</th>
                <th className="px-4 py-3 font-medium">提交时间</th>
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredApplications.map((application) => (
                <tr key={application.id} className="hover:bg-bg/70">
                  <td className="px-4 py-3">
                    <Link href={`/tasks/${application.taskId}`} className="font-medium text-celadon-700 hover:underline">
                      {application.taskTitle}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-text">{application.applicantName}</p>
                    <p className="text-xs text-text-muted">{application.applicantEmail}</p>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={application.status} /></td>
                  <td className="max-w-[360px] px-4 py-3 text-text-muted">
                    <p className="line-clamp-3">{application.message}</p>
                  </td>
                  <td className="px-4 py-3 text-text-muted">{new Date(application.createdAt).toLocaleString('zh-CN')}</td>
                  <td className="px-4 py-3">
                    <ApplicationActions
                      application={application}
                      isLoading={actionApplicationId === application.id}
                      onDecide={decideApplication}
                    />
                  </td>
                </tr>
              ))}
              {isLoading && <tr><td colSpan={6} className="px-4 py-10 text-center text-text-muted">正在加载申请...</td></tr>}
              {!isLoading && filteredApplications.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-text-muted">暂无符合条件的申请</td></tr>}
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

function ApplicationActions({
  application,
  isLoading,
  onDecide,
}: {
  application: TaskApplicationRow;
  isLoading: boolean;
  onDecide: (applicationId: string, decision: 'accepted' | 'rejected') => void;
}) {
  if (application.status !== 'submitted') {
    return <p className="text-right text-xs text-text-muted">已处理</p>;
  }
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" size="sm" className="gap-1.5" isLoading={isLoading} onClick={() => onDecide(application.id, 'accepted')}>
        <Check size={14} aria-hidden="true" />通过
      </Button>
      <Button type="button" size="sm" variant="danger" className="gap-1.5" isLoading={isLoading} onClick={() => onDecide(application.id, 'rejected')}>
        <X size={14} aria-hidden="true" />驳回
      </Button>
    </div>
  );
}
