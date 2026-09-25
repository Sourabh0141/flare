import type { Metadata } from 'next';
import { AdminScreen } from '@/components/admin/admin-screen';
import { RequireAuth } from '@/components/providers/require-auth';

export const metadata: Metadata = {
  title: 'Invite requests',
  robots: { index: false },
};

export default function AdminPage() {
  return (
    <RequireAuth>
      <AdminScreen />
    </RequireAuth>
  );
}
