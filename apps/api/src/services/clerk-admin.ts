import { createClerkClient } from '@clerk/backend';
import type { Logger } from '../lib/logger';

/**
 * Admin role resolution and invitation sending through Clerk.
 *
 * The role can come from the session token itself when the Clerk instance's session token
 * template includes public metadata (`{"metadata": "{{user.public_metadata}}"}`), which
 * makes the check networkless. Otherwise, with a secret key configured, the Worker asks
 * Clerk's Backend API for the user's public metadata.
 */

const ADMIN_ROLE = 'admin';

export function roleFromClaims(claims: Record<string, unknown>): string | null {
  const candidates = [
    (claims.metadata as Record<string, unknown> | undefined)?.role,
    (claims.public_metadata as Record<string, unknown> | undefined)?.role,
    (claims.publicMetadata as Record<string, unknown> | undefined)?.role,
    claims.role,
  ];
  const role = candidates.find((value) => typeof value === 'string');
  return typeof role === 'string' ? role : null;
}

export async function isAdmin(
  claims: Record<string, unknown>,
  userId: string,
  secretKey: string | undefined,
  logger: Logger
): Promise<boolean> {
  const claimed = roleFromClaims(claims);
  if (claimed) return claimed === ADMIN_ROLE;
  if (!secretKey) return false;

  try {
    const clerk = createClerkClient({ secretKey });
    const user = await clerk.users.getUser(userId);
    const role = (user.publicMetadata as Record<string, unknown> | undefined)?.role;
    return role === ADMIN_ROLE;
  } catch (error) {
    logger.warn('admin.role_lookup_failed', { error });
    return false;
  }
}

/**
 * Sends a Clerk invitation email. Returns false when no secret key is configured; the
 * request is still marked approved so it can be invited by hand from the dashboard.
 */
export async function sendInvitation(
  email: string,
  redirectUrl: string | null,
  secretKey: string | undefined,
  logger: Logger
): Promise<boolean> {
  if (!secretKey) return false;
  try {
    const clerk = createClerkClient({ secretKey });
    await clerk.invitations.createInvitation({
      emailAddress: email,
      ...(redirectUrl ? { redirectUrl } : {}),
      ignoreExisting: true,
    });
    return true;
  } catch (error) {
    logger.warn('admin.invitation_failed', { email, error });
    return false;
  }
}
