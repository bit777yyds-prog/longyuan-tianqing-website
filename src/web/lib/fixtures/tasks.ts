import type { Task } from '@longyuan/shared';

export const tasks: Task[] = [
  {
    id: 'task-001',
    title: '整理明代龙泉窑址文献',
    project: '龙渊天青：窑火之书',
    type: '文献整理',
    deliverable: '结构化文献表与引用清单',
    deadline: '2026-08-15',
    reward: '按条目计酬，验收后结算',
    status: 'open',
    slotsRemaining: 3,
    description:
      '将公开的明代龙泉窑址报告、方志与考古简报按统一格式整理为结构化条目，标注关键信息与可信度。',
    acceptanceCriteria: [
      '每条文献包含标题、作者、出处、年代、关键词与摘要',
      '引用格式统一为 GB/T 7714',
      '存疑文献单独标注并附理由',
    ],
    aiRules: [
      '可使用 AI 辅助提取关键词与摘要，但最终事实需人工核对',
      '不得将内部未公开文献上传至外部 AI 服务',
    ],
    qualifications: [
      '具备历史或考古文献阅读经验',
      '能识别繁体竖排材料中的关键信息',
    ],
    faq: [
      { q: '是否需要购买数据库账号？', a: '不需要，任务所需材料均为公开资源。' },
      { q: '提交后多久反馈？', a: '通常 5 个工作日内完成初审。' },
    ],
  },
  {
    id: 'task-002',
    title: '绘制青瓷釉色变化图谱',
    project: '龙渊天青：水形之书',
    type: '视觉研究',
    deliverable: '可交互色卡与说明文档',
    deadline: '2026-09-01',
    reward: '固定报酬 + 署名',
    status: 'assigned',
    slotsRemaining: 0,
    description:
      '基于博物馆公开图像与色谱数据，建立一组可横向对比的青瓷釉色变化图谱。',
    acceptanceCriteria: [
      '至少覆盖 30 件公开器物',
      '色卡需标注器物年代、窑口与图像来源',
      '提供 SVG 或 PDF 矢量输出',
    ],
    aiRules: [
      'AI 可用于颜色聚类与预标注',
      '最终色值需人工确认并注明采集条件',
    ],
    qualifications: [
      '熟悉色彩管理基础',
      '具备图像编辑或数据可视化经验',
    ],
    faq: [
      { q: '需要摄影设备吗？', a: '不需要，使用公开授权图像。' },
    ],
  },
  {
    id: 'task-003',
    title: '校验瓷土配方现代实验记录',
    project: '龙渊天青：瓷土之书',
    type: '数据校验',
    deliverable: '校对批注与差异表',
    deadline: '2026-08-30',
    reward: '按页计酬',
    status: 'under_review',
    slotsRemaining: 0,
    description:
      '对现代仿古瓷土实验记录进行交叉校验，标记原始记录与发表版本之间的差异。',
    acceptanceCriteria: [
      '逐页列出数据差异与可能原因',
      '对无法确认的内容提出复核建议',
      '保持批注可追溯至原始页码',
    ],
    aiRules: [
      '禁止将实验记录原文上传至外部服务',
      'AI 仅可用于格式检查与拼写校对',
    ],
    qualifications: [
      '有化学或材料实验记录阅读经验',
      '细致，能发现数值与单位不一致',
    ],
    faq: [
      { q: '数据是否保密？', a: '是，仅用于本项目内部校验。' },
    ],
  },
];
