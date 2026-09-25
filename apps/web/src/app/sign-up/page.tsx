import type { Metadata } from 'next';
import { AuthPanel } from '@/components/providers/auth-panel';

export const metadata: Metadata = {
  title: 'Accept your invitation',
  robots: { index: false },
};

export default function SignUpPage() {
  return <AuthPanel mode="sign-up" />;
}
