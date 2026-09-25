import type { Metadata } from 'next';
import { AuthPanel } from '@/components/providers/auth-panel';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false },
};

export default function SignInPage() {
  return <AuthPanel mode="sign-in" />;
}
