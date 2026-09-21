'use client';

import React from 'react';
import { ClerkProvider } from '@clerk/clerk-react';
import { ConversationProvider } from '@/context/ConversationContext';

const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  'pk_test_Y2xlcmsuZmxhcmUuZGV2JA==';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <ConversationProvider>{children}</ConversationProvider>
    </ClerkProvider>
  );
}
