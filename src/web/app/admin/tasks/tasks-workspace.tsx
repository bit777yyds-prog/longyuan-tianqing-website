'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Archive, FilePlus2, RotateCcw, Search, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';

type TaskRow = {
  id: string;
  title: string;
  project: string;
  type: string;
  deliverable: string;
  deadline: string;
  reward: string;
  status: string;
  slotsRemaining: number;
  createdAt: string;
};

const statusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'draft', label: '草稿' },
  { value: 'open', label: '开放申请' },
  { value: 'assigned', label: '已分配' },
  { value: 'under_review', label: '验收中' },
  { value: 'closed', label: '已关闭' },
];

const taskTypeOptions = [
  { value: '文献整理', label: '文献整理' },
  { value: '视觉研究', label: '视觉研究' },
  { value: '数据校验', label: '数据校验' },
  { value: '翻译校对', label: '翻译校对' },
  { value: '内容撰写', label: '内容撰写' },
];

export function TasksWorkspace() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionTaskId, setActionTaskId] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    fetch('/api/tasks?scope=admin')
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? '任务列表加载失败');
        if (active) setTasks(payload.tasks);
      })
      .catch((caught) => active && setError(caught instanceof Error ? caught.message : '任务列表加载失败'))
      .finally(() => active && setIsLoading(false));
    return () => { active = false; };
  }, []);

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    const term = query.trim().toLowerCase();
    const matchesQuery = task.title.toLowerCase().includes(term) || task.project.toLowerCase().includes(term);
    return matchesQuery && (status === 'all' || task.status === status);
  }), [query, status, tasks]);

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsSubmitting(true);
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: formData.get('title'),
          projectName: formData.get('projectName'),
          taskType: formData.get('taskType'),
          deliverable: formData.get('deliverable'),
          deliveryDeadline: formData.get('deliveryDeadline'),
          reward: formData.get('reward'),
          slotsTotal: Number(formData.get('slotsTotal')),
          description: formData.get('description'),
          acceptanceCriteria: String(formData.get('acceptanceCriteria') ?? '').split('\n'),
          aiRules: String(formData.get('aiRules') ?? '').split('\n'),
          qualifications: String(formData.get('qualifications') ?? '').split('\n'),
          status: submitter?.value === 'open' ? 'open' : 'draft',
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? '任务创建失败');
      setTasks((current) => [payload.task, ...current]);
      setDialogOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '任务创建失败');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function updateTaskStatus(taskId: string, nextStatus: 'open' | 'closed') {
    setError(undefined);
    setActionTaskId(taskId);
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? '任务状态更新失败');
      setTasks((current) => current.map((task) => task.id === taskId ? payload.task : task));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '任务状态更新失败');
    } finally {
      setActionTaskId(undefined);
    }
  }

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-text md:text-3xl">任务管理</h1>
          <p className="mt-2 text-sm text-text-muted">创建草稿，发布开放任务，并查看任务状态。</p>
        </div>
        <Button type="button" size="sm" className="gap-2" onClick={() => setDialogOpen(true)}>
          <FilePlus2 size={16} aria-hidden="true" />新建任务
        </Button>
      </div>

      <section className="grid gap-3 py-6 sm:grid-cols-4" aria-label="任务概览">
        <Summary label="全部任务" value={tasks.length} />
        <Summary label="开放申请" value={tasks.filter((task) => task.status === 'open').length} />
        <Summary label="草稿" value={tasks.filter((task) => task.status === 'draft').length} />
        <Summary label="验收中" value={tasks.filter((task) => task.status === 'under_review').length} />
      </section>

      <section className="border-t border-border pt-5">
        {error && <p className="mb-4 border border-kiln-500 bg-kiln-100 px-3 py-2 text-sm text-status-risk" role="alert">{error}</p>}
        <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_180px_auto] md:items-end">
          <label className="relative block">
            <span className="sr-only">搜索任务</span>
            <Search size={16} className="pointer-events-none absolute left-3 top-3 text-text-muted" aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索任务或项目" className="w-full rounded-sm border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-celadon-700" />
          </label>
          <Select label="状态" className="[&>label]:sr-only" options={statusOptions} value={status} onChange={(event) => setStatus(event.target.value)} />
          <p className="pb-2 text-right text-sm text-text-muted">{filteredTasks.length} 个任务</p>
        </div>

        <div className="mt-4 overflow-x-auto border-y border-border bg-surface">
          <table className="w-full min-w-[960px] border-collapse text-left text-sm">
            <thead className="bg-bg text-xs text-text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">任务</th><th className="px-4 py-3 font-medium">类型</th>
                <th className="px-4 py-3 font-medium">状态</th><th className="px-4 py-3 font-medium">交付物</th>
                <th className="px-4 py-3 font-medium">截止时间</th><th className="px-4 py-3 font-medium">名额</th>
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredTasks.map((task) => (
                <tr key={task.id} className="hover:bg-bg/70">
                  <td className="px-4 py-3"><p className="font-medium text-text">{task.title}</p><p className="text-xs text-text-muted">{task.project}</p></td>
                  <td className="px-4 py-3 text-text-muted">{task.type}</td>
                  <td className="px-4 py-3"><StatusBadge status={task.status} /></td>
                  <td className="px-4 py-3 text-text-muted">{task.deliverable}</td>
                  <td className="px-4 py-3 text-text-muted">{task.deadline}</td>
                  <td className="px-4 py-3 text-text-muted">{task.slotsRemaining}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <TaskStatusAction task={task} isLoading={actionTaskId === task.id} onUpdate={updateTaskStatus} />
                      {task.status === 'draft' ? (
                        <span className="text-xs text-text-muted">未公开</span>
                      ) : (
                        <Link href={`/tasks/${task.id}`} className="whitespace-nowrap text-sm font-medium text-celadon-700 hover:underline">查看前台</Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {isLoading && <tr><td colSpan={7} className="px-4 py-10 text-center text-text-muted">正在加载任务...</td></tr>}
              {!isLoading && filteredTasks.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-text-muted">暂无符合条件的任务</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="新建任务" description="发布后会出现在前台开放任务列表。">
        <form className="grid max-h-[70vh] gap-4 overflow-y-auto pr-1" onSubmit={createTask}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="任务标题" name="title" required />
            <Input label="所属项目" name="projectName" defaultValue="龙渊天青：窑火之书" required />
            <Select label="任务类型" name="taskType" options={taskTypeOptions} required />
            <Input label="交付截止日" name="deliveryDeadline" type="date" />
            <Input label="名额" name="slotsTotal" type="number" min={1} max={999} defaultValue={1} required />
            <Input label="报酬" name="reward" placeholder="固定报酬 / 按条目计酬 / 署名" />
          </div>
          <Input label="交付物" name="deliverable" placeholder="结构化表格、校对批注、说明文档等" required />
          <Textarea label="任务说明" name="description" required />
          <Textarea label="验收标准" name="acceptanceCriteria" placeholder="每行一条" required />
          <Textarea label="AI 使用规则" name="aiRules" placeholder="每行一条" required />
          <Textarea label="申请资格" name="qualifications" placeholder="每行一条" required />
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button type="submit" name="intent" value="draft" variant="secondary" isLoading={isSubmitting}>保存草稿</Button>
            <Button type="submit" name="intent" value="open" isLoading={isSubmitting}>发布任务</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="border border-border bg-surface px-4 py-3"><p className="text-xs text-text-muted">{label}</p><p className="mt-1 text-2xl font-semibold text-text">{value}</p></div>;
}

function TaskStatusAction({
  task,
  isLoading,
  onUpdate,
}: {
  task: TaskRow;
  isLoading: boolean;
  onUpdate: (taskId: string, nextStatus: 'open' | 'closed') => void;
}) {
  if (task.status === 'draft') {
    return (
      <Button type="button" size="sm" className="gap-1.5" isLoading={isLoading} onClick={() => onUpdate(task.id, 'open')}>
        <Send size={14} aria-hidden="true" />发布
      </Button>
    );
  }
  if (task.status === 'open') {
    return (
      <Button type="button" size="sm" variant="secondary" className="gap-1.5" isLoading={isLoading} onClick={() => onUpdate(task.id, 'closed')}>
        <Archive size={14} aria-hidden="true" />关闭
      </Button>
    );
  }
  if (task.status === 'closed') {
    return (
      <Button type="button" size="sm" variant="secondary" className="gap-1.5" isLoading={isLoading} onClick={() => onUpdate(task.id, 'open')}>
        <RotateCcw size={14} aria-hidden="true" />重开
      </Button>
    );
  }
  return <span className="text-xs text-text-muted">不可变更</span>;
}

function Textarea({ label, name, placeholder, required }: { label: string; name: string; placeholder?: string; required?: boolean }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-text">{label}{required && <span aria-hidden="true" className="ml-0.5 text-status-risk">*</span>}</span>
      <textarea name={name} placeholder={placeholder} required={required} rows={4} className="rounded-md border border-border bg-surface px-3 py-2 text-base text-text placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-celadon-700 focus-visible:ring-offset-2 focus-visible:ring-offset-bg" />
    </label>
  );
}
