'use client';

import { RedirectToSignIn, SignedIn, SignedOut, useAuth } from '@clerk/clerk-react';
import type { ReactNode } from 'react';
import { AvatarPlaceholder } from '../avatar/avatar-placeholder';

/** Gate for the assistant: waits for Clerk, then renders children or sends to sign-in. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoaded } = useAuth();
  if (!isLoaded) {
    return (
      <div className="relative h-dvh w-full">
        <AvatarPlaceholder label="Checking your session" />
      </div>
    );
  }
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
