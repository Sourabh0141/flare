import type { Metadata } from 'next';
import { AssistantShell } from '@/components/assistant/assistant-shell';
import { RequireAuth } from '@/components/providers/require-auth';

export const metadata: Metadata = {
  title: 'Talk to Flare',
  robots: { index: false },
};

export default function AssistantPage() {
  return (
    <RequireAuth>
      <AssistantShell />
    </RequireAuth>
  );
}
