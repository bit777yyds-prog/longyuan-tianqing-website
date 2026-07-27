import Link from 'next/link';
import { ArrowRight, ClipboardCheck, MailPlus, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { adminActivity, adminMetrics, adminQueue } from '@/lib/fixtures/admin';

export const metadata = { title: '工作台 - 龙渊天青' };

const metricTone = {
  neutral: 'border-l-celadon-500',
  info: 'border-l-status-info',
  warning: 'border-l-status-warning',
  success: 'border-l-status-success',
};

export default function AdminDashboardPage() {
  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-text-muted">2026 年 7 月 26 日</p>
          <h1 className="mt-1 font-serif text-2xl font-semibold text-text md:text-3xl">工作台</h1>
          <p className="mt-2 text-sm text-text-muted">需要你处理的工作与近期运行情况。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href="/admin/users"><UserPlus size={16} aria-hidden="true" />管理用户</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/admin/invitations"><MailPlus size={16} aria-hidden="true" />新建邀请</Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-3 py-6 sm:grid-cols-2 xl:grid-cols-4" aria-label="运行概览">
        {adminMetrics.map((metric) => (
          <div key={metric.label} className={`border border-border border-l-4 bg-surface p-4 ${metricTone[metric.tone]}`}>
            <p className="text-sm text-text-muted">{metric.label}</p>
            <p className="mt-2 text-3xl font-semibold text-text">{metric.value}</p>
            <p className="mt-1 text-xs text-text-muted">{metric.change}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-8 border-t border-border pt-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-xl font-semibold text-text">待处理队列</h2>
              <p className="mt-1 text-sm text-text-muted">按等待时间与风险排序</p>
            </div>
            <ClipboardCheck size={20} className="text-celadon-700" aria-hidden="true" />
          </div>
          <div className="mt-4 divide-y divide-border border-y border-border bg-surface">
            {adminQueue.map((item) => (
              <div key={item.id} className="flex items-start gap-4 px-4 py-4">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.priority === 'high' ? 'bg-status-risk' : 'bg-status-info'}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">{item.title}</p>
                  <p className="mt-1 text-xs text-text-muted">{item.type} · {item.owner}</p>
                </div>
                <span className="shrink-0 text-xs text-text-muted">{item.age}</span>
                <button type="button" className="shrink-0 rounded-sm p-1 text-text-muted hover:bg-bg hover:text-text" aria-label={`处理 ${item.title}`}>
                  <ArrowRight size={17} />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-xl font-semibold text-text">最近活动</h2>
              <p className="mt-1 text-sm text-text-muted">来自审计日志的最新记录</p>
            </div>
            <span className="text-sm text-text-muted">{adminActivity.length} 条</span>
          </div>
          <ol className="mt-4 divide-y divide-border border-y border-border bg-surface">
            {adminActivity.map((activity) => (
              <li key={activity.id} className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-text"><span className="font-medium">{activity.actor}</span> {activity.action}</p>
                  <time className="shrink-0 text-xs text-text-muted">{activity.time}</time>
                </div>
                <p className="mt-1 truncate text-xs text-text-muted">{activity.subject}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
