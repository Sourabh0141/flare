'use client';

import type { InviteRequestRecord, InviteStatus } from '@flare/contracts';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from '@/hooks/use-api-client';
import { describeError } from '@/lib/api/client';
import { cn, formatRelativeTime } from '@/lib/utils';
import { Button } from '../ui/button';
import { Spinner } from '../ui/spinner';
import { Wordmark } from '../ui/wordmark';

const TABS: Array<{ id: InviteStatus; label: string }> = [
  { id: 'pending', label: 'Waiting' },
  { id: 'approved', label: 'Approved' },
  { id: 'dismissed', label: 'Dismissed' },
];

/** Review invite requests. Approving sends the Clerk invitation when the API can. */
export function AdminScreen() {
  const api = useApiClient();
  const [access, setAccess] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const [tab, setTab] = useState<InviteStatus>('pending');
  const [invites, setInvites] = useState<InviteRequestRecord[]>([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, dismissed: 0 });
  /** Which tab the current list belongs to; loading is derived from the mismatch. */
  const [loadedTab, setLoadedTab] = useState<InviteStatus | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status: 'loading' | 'ready' | 'error' = loadFailed
    ? 'error'
    : loadedTab === tab
      ? 'ready'
      : 'loading';
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(
    (which: InviteStatus, signal?: AbortSignal) =>
      api
        .listInvites(which, signal)
        .then((page) => {
          if (signal?.aborted) return;
          setInvites(page.invites);
          setCounts(page.counts);
          setLoadedTab(which);
          setLoadFailed(false);
        })
        .catch((cause: unknown) => {
          if (signal?.aborted) return;
          setError(describeError(cause));
          setLoadFailed(true);
        }),
    [api]
  );

  useEffect(() => {
    const controller = new AbortController();
    api
      .getAdminStatus(controller.signal)
      .then((allowed) => {
        if (controller.signal.aborted) return;
        setAccess(allowed ? 'allowed' : 'denied');
      })
      .catch(() => {
        if (!controller.signal.aborted) setAccess('denied');
      });
    return () => controller.abort();
  }, [api]);

  useEffect(() => {
    if (access !== 'allowed') return;
    const controller = new AbortController();
    void load(tab, controller.signal);
    return () => controller.abort();
  }, [access, tab, load]);

  const review = async (invite: InviteRequestRecord, decision: 'approved' | 'dismissed') => {
    setBusyId(invite.id);
    setNotice(null);
    setError(null);
    try {
      const result = await api.reviewInvite(invite.id, decision);
      setInvites((list) => list.filter((i) => i.id !== invite.id));
      setCounts((c) => ({
        ...c,
        [invite.status]: Math.max(0, c[invite.status] - 1),
        [decision]: c[decision] + 1,
      }));
      setNotice(
        decision === 'dismissed'
          ? `Dismissed ${invite.email}.`
          : result.invitationSent
            ? `Invitation sent to ${invite.email}.`
            : `Marked ${invite.email} approved. Send the invitation from the Clerk dashboard (no secret key on the API).`
      );
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-5 py-8 sm:px-8">
      <div className="flex items-center justify-between">
        <Link href="/" className="rounded-md" aria-label="Flare home">
          <Wordmark />
        </Link>
        <Link
          href="/app/"
          className="type-ui inline-flex h-9 items-center gap-2 rounded-md px-3 text-[15px] text-linen-dim transition-colors hover:text-linen"
        >
          <ArrowLeft className="size-4" /> Back to Flare
        </Link>
      </div>

      <h1 className="type-display mt-10 text-4xl text-linen sm:text-5xl">Invite requests</h1>

      {access === 'checking' ? (
        <div className="mt-8 flex items-center gap-2 text-sm text-smoke">
          <Spinner className="size-4" /> Checking access
        </div>
      ) : access === 'denied' ? (
        <p className="mt-6 max-w-lg text-linen-dim">
          This area is for administrators. To grant access, set{' '}
          <code className="rounded-sm bg-soot px-1.5 py-0.5 text-sm text-ember-soft">
            {'{"role": "admin"}'}
          </code>{' '}
          as the user&apos;s public metadata in the Clerk dashboard.
        </p>
      ) : (
        <>
          <div
            role="tablist"
            aria-label="Request status"
            className="mt-8 flex gap-1 border-b border-ash/60"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'type-ui -mb-px border-b-2 px-3 py-2 text-[15px] transition-colors',
                  tab === t.id
                    ? 'border-ember text-linen'
                    : 'border-transparent text-linen-dim hover:text-linen'
                )}
              >
                {t.label}
                <span className="ml-1.5 text-xs text-smoke">{counts[t.id]}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 min-h-6 text-sm" aria-live="polite">
            {error ? <span className="text-rust">{error}</span> : null}
            {notice ? <span className="text-moss">{notice}</span> : null}
          </div>

          {status === 'loading' ? (
            <div className="flex items-center gap-2 py-8 text-sm text-smoke">
              <Spinner className="size-4" /> Loading
            </div>
          ) : status === 'error' ? (
            <Button
              variant="secondary"
              className="self-start"
              onClick={() => {
                setLoadFailed(false);
                setLoadedTab(null);
                void load(tab);
              }}
            >
              Try again
            </Button>
          ) : invites.length === 0 ? (
            <p className="py-8 text-sm text-smoke">Nothing here.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-ash/60">
              {invites.map((invite) => (
                <li key={invite.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium text-linen">
                      {invite.name}
                      <span className="ml-2 font-normal text-linen-dim">{invite.email}</span>
                    </p>
                    {invite.reason ? (
                      <p className="mt-1 max-w-xl text-sm leading-relaxed text-linen-dim">
                        {invite.reason}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-smoke">
                      Asked {formatRelativeTime(invite.createdAt)}
                      {invite.reviewedAt
                        ? `, reviewed ${formatRelativeTime(invite.reviewedAt)}`
                        : ''}
                    </p>
                  </div>
                  {invite.status !== 'approved' ? (
                    <div className="flex shrink-0 gap-2">
                      {invite.status === 'pending' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void review(invite, 'dismissed')}
                          disabled={busyId === invite.id}
                        >
                          Dismiss
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        onClick={() => void review(invite, 'approved')}
                        loading={busyId === invite.id}
                      >
                        Approve and invite
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
