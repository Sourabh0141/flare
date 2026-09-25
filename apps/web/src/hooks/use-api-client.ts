'use client';

import { useAuth } from '@clerk/clerk-react';
import { useMemo } from 'react';
import { ApiClient } from '@/lib/api/client';

/** An API client bound to the current Clerk session. Stable for the life of the session. */
export function useApiClient(): ApiClient {
  const { getToken } = useAuth();
  return useMemo(() => new ApiClient(() => getToken()), [getToken]);
}
