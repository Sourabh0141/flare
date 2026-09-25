import type { Message } from '@flare/contracts';
import { describe, expect, it } from 'vitest';
import { formatTranscript, transcriptFileName } from './transcript-export';

const at = Math.floor(new Date('2026-09-25T10:42:00').getTime() / 1000);

const messages: Message[] = [
  {
    id: 's',
    conversationId: 'c',
    role: 'summary',
    content: 'Ada likes tea.',
    emotion: null,
    gesture: null,
    createdAt: at - 100,
  },
  {
    id: '1',
    conversationId: 'c',
    role: 'user',
    content: 'Morning!',
    emotion: null,
    gesture: null,
    createdAt: at,
  },
  {
    id: '2',
    conversationId: 'c',
    role: 'assistant',
    content: 'Good morning, Ada.',
    emotion: 'happy',
    gesture: 'nod',
    createdAt: at + 1,
  },
  {
    id: '3',
    conversationId: 'c',
    role: 'assistant',
    content: 'Tea first?',
    emotion: 'neutral',
    gesture: 'none',
    createdAt: at + 2,
  },
];

describe('formatTranscript', () => {
  it('renders speakers, moods, times and summaries', () => {
    const text = formatTranscript({ title: 'Tea plans', createdAt: at }, messages);
    expect(text.startsWith('Tea plans\nStarted ')).toBe(true);
    expect(text).toContain('[Earlier, summarised] Ada likes tea.');
    expect(text).toContain('You · 10:42 AM\nMorning!');
    expect(text).toContain('Flare (happy) · 10:42 AM\nGood morning, Ada.');
    expect(text).toContain('Flare · 10:42 AM\nTea first?');
    expect(text.endsWith('\n')).toBe(true);
  });

  it('works without a conversation record', () => {
    const text = formatTranscript(null, messages.slice(1, 2));
    expect(text).toMatch(/^Conversation with Flare\n\nYou/);
  });
});

describe('transcriptFileName', () => {
  it('slugs titles and falls back sensibly', () => {
    expect(transcriptFileName('Weekend plans, again!')).toBe('flare-weekend-plans-again.txt');
    expect(transcriptFileName('   ')).toBe('flare-conversation.txt');
    expect(transcriptFileName(null)).toBe('flare-conversation.txt');
  });
});
