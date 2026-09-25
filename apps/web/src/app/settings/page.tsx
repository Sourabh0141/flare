import type { Metadata } from 'next';
import { RequireAuth } from '@/components/providers/require-auth';
import { SettingsScreen } from '@/components/settings/settings-screen';

export const metadata: Metadata = {
  title: 'Settings',
  robots: { index: false },
};

export default function SettingsPage() {
  return (
    <RequireAuth>
      <SettingsScreen />
    </RequireAuth>
  );
}
