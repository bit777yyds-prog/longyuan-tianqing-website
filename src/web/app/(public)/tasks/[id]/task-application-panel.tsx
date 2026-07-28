'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

export function TaskApplicationPanel({ taskId }: { taskId: string }) {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'success'>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/tasks/${taskId}/applications`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? '申请提交失败');
      setStatus('success');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '申请提交失败');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (status === 'success') {
    return (
      <div className="rounded-md border border-status-success bg-status-success/10 p-4 text-sm text-status-success" role="status">
        申请已提交，管理员会在后台查看并处理。
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={submitApplication}>
      <div className="space-y-3 rounded-md border border-border bg-surface p-4">
        <Checkbox
          label="我确认有权提交所提供材料"
          description="提交内容不侵犯第三方版权或隐私。"
          required
        />
        <Checkbox
          label="我同意按规则使用 AI 辅助"
          description="不将内部或保密材料上传至外部服务。"
          required
        />
        <Checkbox
          label="我接受任务的报酬与版权约定"
          description="公开署名方式以任务说明为准。"
          required
        />
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-text">申请说明</span>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          placeholder="简要说明你的经验、计划和可交付时间。"
          className="rounded-md border border-border bg-surface px-3 py-2 text-base text-text placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-celadon-700 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        />
      </label>
      {error && (
        <p className="border border-kiln-500 bg-kiln-100 px-3 py-2 text-sm text-status-risk" role="alert">
          {error}
          {error.includes('登录') && (
            <Link href="/login" className="ml-2 font-medium underline">
              去登录
            </Link>
          )}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" className="gap-2" isLoading={isSubmitting}>
          <Send size={16} aria-hidden="true" />申请任务
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/tasks">返回列表</Link>
        </Button>
      </div>
    </form>
  );
}
