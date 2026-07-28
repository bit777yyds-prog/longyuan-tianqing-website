export const invitations = [
  {
    id: 'inv-001',
    invitedEmail: 'reviewer@example.com',
    invitedRole: 'reviewer',
    status: 'active',
    createdBy: '管理员',
    createdAt: '2026-07-26',
    expiresAt: '2026-08-02',
  },
  {
    id: 'inv-002',
    invitedEmail: 'partner@example.com',
    invitedRole: 'project_owner',
    status: 'used',
    createdBy: '管理员',
    createdAt: '2026-07-24',
    expiresAt: '2026-07-31',
  },
  {
    id: 'inv-003',
    invitedEmail: 'reader@example.com',
    invitedRole: 'participant',
    status: 'revoked',
    createdBy: '管理员',
    createdAt: '2026-07-20',
    expiresAt: '2026-07-27',
  },
] as const;

export const roleOptions = [
  { value: 'participant', label: '参与者' },
  { value: 'reviewer', label: '验收者' },
  { value: 'project_owner', label: '项目负责人' },
  { value: 'admin', label: '管理员' },
];

export const invitationStatusLabels: Record<string, string> = {
  active: '有效',
  used: '已使用',
  revoked: '已撤销',
  expired: '已过期',
};

export const invitationRoleLabels: Record<string, string> = {
  participant: '参与者',
  reviewer: '验收者',
  project_owner: '项目负责人',
  admin: '管理员',
};
