'use client';

import type { Message } from '@flare/contracts';
import { Check, Copy, Download, Play, Volume2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { downloadText, formatTranscript, transcriptFileName } from '@/lib/transcript-export';
import { cn, formatClock } from '@/lib/utils';
import { useAssistantStore } from '@/stores/assistant-store';
import { useConversationStore } from '@/stores/conversation-store';
import { IconButton } from '../ui/icon-button';
import { Spinner } from '../ui/spinner';

export interface TranscriptPanelProps {
  open: boolean;
  onClose: () => void;
  onReplay: (messageId: string) => void;
  className?: string;
}

const emotionLabels: Record<NonNullable<Message['emotion']>, string> = {
  neutral: 'calm',
  happy: 'happy',
  excited: 'excited',
  amused: 'amused',
  sad: 'sad',
  surprised: 'surprised',
  thoughtful: 'thoughtful',
  concerned: 'concerned',
  playful: 'playful',
  annoyed: 'annoyed',
};

/** Written record of the conversation with replay for each of Flare's replies. */
export function TranscriptPanel({ open, onClose, onReplay, className }: TranscriptPanelProps) {
  const messages = useConversationStore((s) => s.messages);
  const status = useConversationStore((s) => s.transcriptStatus);
  const error = useConversationStore((s) => s.transcriptError);
  const pending = useConversationStore((s) => s.pendingTurn);
  const activeId = useConversationStore((s) => s.activeId);
  const activeConversation = useConversationStore(
    (s) => s.conversations.find((c) => c.id === s.activeId) ?? null
  );
  const speakingId = useAssistantStore((s) => s.speakingMessageId);
  const state = useAssistantStore((s) => s.state);
  const endRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages.length, pending?.reply.length, state]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const canReplay = state === 'idle' || state === 'speaking' || state === 'listening';
  const hasContent = messages.length > 0;

  const copyTranscript = async () => {
    try {
      await navigator.clipboard.writeText(formatTranscript(activeConversation, messages));
      setCopied(true);
    } catch {
      // Clipboard can be unavailable; the download button still works.
    }
  };

  const exportTranscript = () => {
    downloadText(
      transcriptFileName(activeConversation?.title),
      formatTranscript(activeConversation, messages)
    );
  };

  return (
    <aside
      aria-label="Transcript"
      aria-hidden={!open}
      className={cn(
        'flex h-full w-full flex-col border-ash/70 bg-soot/95 backdrop-blur-md transition-transform duration-300 ease-out-soft',
        'lg:w-[22rem] lg:border-l',
        open ? 'translate-x-0' : 'translate-x-full lg:hidden',
        className
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-ash/70 px-4">
        <h2 className="type-ui text-[15px] font-medium text-linen">Transcript</h2>
        <div className="flex items-center gap-0.5">
          <IconButton
            label={copied ? 'Copied' : 'Copy transcript'}
            size="sm"
            onClick={() => void copyTranscript()}
            disabled={!hasContent}
          >
            {copied ? <Check className="size-4 text-moss" /> : <Copy className="size-4" />}
          </IconButton>
          <IconButton
            label="Download transcript"
            size="sm"
            onClick={exportTranscript}
            disabled={!hasContent}
          >
            <Download className="size-4" />
          </IconButton>
          <IconButton label="Hide transcript" size="sm" onClick={onClose}>
            <X className="size-4" />
          </IconButton>
        </div>
      </div>

      <div className="flex-1 scrollbar-thin overflow-y-auto px-4 py-4" aria-live="polite">
        {status === 'loading' ? (
          <div className="flex items-center gap-2 py-8 text-sm text-smoke">
            <Spinner className="size-4" /> Loading transcript
          </div>
        ) : status === 'error' ? (
          <p className="py-8 text-sm text-rust">{error}</p>
        ) : messages.length === 0 && !pending ? (
          <div className="py-10 text-sm text-smoke">
            {activeId
              ? 'This conversation has no messages yet.'
              : 'Nothing here yet. Say hello; what you both say shows up here.'}
          </div>
        ) : (
          <ol className="flex flex-col gap-4">
            {messages.map((message) => (
              <li key={message.id}>
                {message.role === 'summary' ? (
                  <SummaryRow message={message} />
                ) : message.role === 'user' ? (
                  <UserRow message={message} />
                ) : (
                  <AssistantRow
                    message={message}
                    speaking={speakingId === message.id}
                    canReplay={canReplay}
                    onReplay={() => onReplay(message.id)}
                  />
                )}
              </li>
            ))}
            {pending ? (
              <li className="flex flex-col gap-3">
                <UserRow message={{ content: pending.transcript }} pending />
                {pending.reply ? (
                  <div className="flex flex-col gap-1 rounded-md border-l-2 border-ember pl-3">
                    <div className="flex items-center gap-2 text-xs text-smoke">
                      <span className="font-medium text-ember-soft">Flare</span>
                      <span>{state === 'speaking' ? 'speaking' : 'writing'}</span>
                    </div>
                    <p className="text-[15px] leading-relaxed text-linen">{pending.reply}</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-dusk">
                    <Spinner className="size-4" /> Flare is thinking
                  </div>
                )}
              </li>
            ) : null}
          </ol>
        )}
        <div ref={endRef} />
      </div>
    </aside>
  );
}

function UserRow({
  message,
  pending = false,
}: {
  message: Pick<Message, 'content'> & Partial<Message>;
  pending?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2 text-xs text-smoke">
        <span className="font-medium text-linen-dim">You</span>
        {message.createdAt ? (
          <time>{formatClock(message.createdAt)}</time>
        ) : pending ? (
          <span>heard</span>
        ) : null}
      </div>
      <p className={cn('text-[15px] leading-relaxed text-linen', pending && 'text-linen-dim')}>
        {message.content}
      </p>
    </div>
  );
}

function AssistantRow({
  message,
  speaking,
  canReplay,
  onReplay,
}: {
  message: Message;
  speaking: boolean;
  canReplay: boolean;
  onReplay: () => void;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-md border-l-2 pl-3 transition-colors',
        speaking ? 'border-ember' : 'border-ash'
      )}
    >
      <div className="flex items-center gap-2 text-xs text-smoke">
        <span className="font-medium text-ember-soft">Flare</span>
        <time>{formatClock(message.createdAt)}</time>
        {message.emotion && message.emotion !== 'neutral' ? (
          <span className="rounded-pill bg-soot-raised px-2 py-0.5 text-[11px] text-linen-dim">
            {emotionLabels[message.emotion]}
          </span>
        ) : null}
        {message.language && message.language !== 'en' ? (
          <span className="rounded-pill bg-soot-raised px-2 py-0.5 text-[11px] text-linen-dim uppercase">
            {message.language}
          </span>
        ) : null}
        <IconButton
          label={speaking ? 'Playing' : 'Play this reply'}
          size="sm"
          onClick={onReplay}
          disabled={!canReplay || speaking}
          className="-mr-1 ml-auto"
        >
          {speaking ? <Volume2 className="size-4 text-ember" /> : <Play className="size-4" />}
        </IconButton>
      </div>
      <p className="text-[15px] leading-relaxed text-linen">{message.content}</p>
    </div>
  );
}

function SummaryRow({ message }: { message: Message }) {
  return (
    <div className="rounded-md bg-ink/60 px-3 py-2.5 text-sm text-linen-dim">
      <p className="mb-1 text-xs text-smoke">Earlier in this conversation</p>
      <p className="leading-relaxed">{message.content}</p>
    </div>
  );
}
