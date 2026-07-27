import { redirect } from 'next/navigation';

export default function LegacyInvitationsPage() {
  redirect('/admin/invitations');
}
