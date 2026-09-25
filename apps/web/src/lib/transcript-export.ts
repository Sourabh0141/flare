import type { Conversation, Message } from '@flare/contracts';

/** Plain-text rendering of a conversation for copying or downloading. */
export function formatTranscript(
  conversation: Pick<Conversation, 'title' | 'createdAt'> | null,
  messages: Message[]
): string {
  const title = conversation?.title ?? 'Conversation with Flare';
  const started = conversation
    ? new Date(conversation.createdAt * 1000).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;

  const lines = [title, started ? `Started ${started}` : null, ''].filter(
    (line): line is string => line !== null
  );

  for (const message of messages) {
    const time = new Date(message.createdAt * 1000).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    if (message.role === 'summary') {
      lines.push(`[Earlier, summarised] ${message.content}`, '');
      continue;
    }
    const speaker = message.role === 'user' ? 'You' : 'Flare';
    const mood =
      message.role === 'assistant' && message.emotion && message.emotion !== 'neutral'
        ? ` (${message.emotion})`
        : '';
    lines.push(`${speaker}${mood} · ${time}`, message.content, '');
  }

  return lines.join('\n').trimEnd() + '\n';
}

/** Safe file name from a title: letters, digits and dashes only. */
export function transcriptFileName(title: string | null | undefined): string {
  const slug = (title ?? 'conversation')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `flare-${slug || 'conversation'}.txt`;
}

export function downloadText(fileName: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
