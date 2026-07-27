export const adminMetrics = [
  { label: '进行中项目', value: '4', change: '2 个本周有更新', tone: 'neutral' },
  { label: '开放任务', value: '7', change: '剩余 12 个名额', tone: 'info' },
  { label: '待处理验收', value: '3', change: '1 项已等待两天', tone: 'warning' },
  { label: '活跃参与者', value: '18', change: '近 30 天', tone: 'success' },
] as const;

export const adminQueue = [
  { id: 'q-1', title: '明代窑址文献整理 · 第三批', type: '交付验收', owner: '林澜', age: '6 小时', priority: 'high' },
  { id: 'q-2', title: '青瓷釉色图谱补充说明', type: '返工复核', owner: '周叙', age: '1 天', priority: 'normal' },
  { id: 'q-3', title: 'Agent 候选事件 #1842', type: '事件审批', owner: '研究助手', age: '2 天', priority: 'high' },
] as const;

export const adminActivity = [
  { id: 'a-1', action: '完成注册', subject: 'reviewer@example.com', actor: '受邀用户', time: '今天 10:32' },
  { id: 'a-2', action: '创建邀请', subject: 'editor@example.com · 验收者', actor: '系统管理员', time: '今天 09:18' },
  { id: 'a-3', action: '批准候选事件', subject: 'candidate_event #1840', actor: '林澜', time: '昨天 18:44' },
  { id: 'a-4', action: '更新项目', subject: '龙渊天青：水形之书', actor: '沈青', time: '昨天 15:07' },
] as const;

export const adminUsers = [
  { id: 'usr-001', name: '林澜', email: 'reviewer@example.com', role: 'reviewer', status: 'active', lastSeen: '12 分钟前', joinedAt: '2026-07-25' },
  { id: 'usr-002', name: '沈青', email: 'owner@example.com', role: 'project_owner', status: 'active', lastSeen: '1 小时前', joinedAt: '2026-07-18' },
  { id: 'usr-003', name: '周叙', email: 'participant@example.com', role: 'participant', status: 'active', lastSeen: '昨天', joinedAt: '2026-07-20' },
  { id: 'usr-004', name: '程砚', email: 'reader@example.com', role: 'participant', status: 'disabled', lastSeen: '8 天前', joinedAt: '2026-06-29' },
  { id: 'usr-005', name: '系统管理员', email: 'admin@longyuan.local', role: 'admin', status: 'active', lastSeen: '刚刚', joinedAt: '2026-06-01' },
] as const;
