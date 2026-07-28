import { TaskCard } from '@/components/business/task-card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { createDatabaseClient } from '@/server/db/client';
import { SqlTaskRepository } from '@/server/db/task-repository';
import { TaskService } from '@/server/domain/task-service';

export const metadata = {
  title: '任务 - 龙渊天青',
};

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const tasks = await new TaskService(new SqlTaskRepository(createDatabaseClient())).listTasks({ includeDrafts: false });
  const types = Array.from(new Set(tasks.map((t) => t.type)));

  return (
    <div className="px-4 py-12 md:px-8 lg:px-16">
      <div className="mx-auto max-w-content">
        <h1 className="font-serif text-3xl font-semibold text-text md:text-h1">开放任务</h1>
        <p className="mt-3 text-text-muted">参与研究、整理与校验工作，按贡献获得报酬与署名。</p>

        <div className="mt-8 grid gap-4 rounded-lg border border-border bg-surface p-4 md:grid-cols-3">
          <Input label="搜索任务" placeholder="输入关键词" />
          <Select
            label="任务类型"
            options={[{ value: '', label: '全部' }, ...types.map((t) => ({ value: t, label: t }))]}
          />
          <Select
            label="状态"
            options={[
              { value: '', label: '全部' },
              { value: 'open', label: '开放申请' },
              { value: 'assigned', label: '已分配' },
              { value: 'under_review', label: '验收中' },
              { value: 'closed', label: '已关闭' },
            ]}
          />
        </div>

        {tasks.length === 0 ? (
          <div className="mt-8 border-y border-border bg-surface px-4 py-12 text-center text-text-muted">
            暂无已发布任务。
          </div>
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
