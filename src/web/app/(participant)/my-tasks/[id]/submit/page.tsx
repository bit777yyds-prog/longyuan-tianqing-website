import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusBadge } from '@/components/ui/status-badge';
import { requireAuthenticatedUser } from '@/server/auth/authorization';
import { createDatabaseClient } from '@/server/db/client';
import { SqlMyTaskRepository } from '@/server/db/my-task-repository';
import { MyTaskService } from '@/server/domain/my-task-service';

interface SubmitPageProps {
  params: Promise<{ id: string }>;
}

export default async function SubmitDeliverablePage({ params }: SubmitPageProps) {
  const { id } = await params;
  const user = await requireAuthenticatedUser(await headers());
  const assignment = await new MyTaskService(
    new SqlMyTaskRepository(createDatabaseClient())
  ).findAssignedTask(user.actorId, id);
  if (!assignment) notFound();
  const { task } = assignment;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={assignment.assignmentStatus} />
        <span className="text-sm text-text-muted">{task.project}</span>
      </div>
      <h1 className="mt-3 font-serif text-3xl font-semibold text-text">提交交付物</h1>
      <p className="mt-1 text-text-muted">{task.title}</p>

      <form className="mt-8 space-y-6 rounded-lg border border-border bg-surface p-6">
        <Input label="版本说明" placeholder="例如：初稿、修订版 v2" required />
        <Input label="文件链接或哈希" placeholder="上传完成后填入链接或 SHA256" required />
        <Textarea
          label="交付说明"
          placeholder="说明本次交付的内容、与任务要求的对应关系，以及任何需要审校者注意的问题。"
          required
        />

        <div className="space-y-3 rounded-md bg-bg p-4">
          <Checkbox
            label="我确认有权提交这些材料"
            description="提交内容不侵犯第三方版权或隐私。"
            required
          />
          <Checkbox
            label="我同意按任务规则使用 AI 辅助"
            description="不将内部或保密材料上传至外部服务。"
            required
          />
          <Checkbox
            label="我允许匿名形成实验数据"
            description="用于改进任务流程与验收标准，不包含可识别个人信息。"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="submit">提交交付物</Button>
          <Button type="button" variant="secondary">
            保存草稿
          </Button>
        </div>
      </form>
    </div>
  );
}
