'use client';

import { useEffect, useState } from 'react';
import { useApiClient } from './use-api-client';

let cached: boolean | null = null;

/** Whether the signed-in user may open the admin area. Checked once per page load. */
export function useAdminStatus(): boolean {
  const api = useApiClient();
  const [isAdmin, setIsAdmin] = useState<boolean>(cached ?? false);

  useEffect(() => {
    if (cached !== null) return;
    const controller = new AbortController();
    api
      .getAdminStatus(controller.signal)
      .then((value) => {
        cached = value;
        if (!controller.signal.aborted) setIsAdmin(value);
      })
      .catch(() => {
        // Not knowing simply hides the link; the API still guards the routes.
      });
    return () => controller.abort();
  }, [api]);

  return isAdmin;
}
