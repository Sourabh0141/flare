import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor } from '@flare/db';
import { parseAllowedOrigins } from '../src/config/env';
import { createOriginMatcher } from '../src/middleware/cors';
import { parseAssistantTurn, sanitiseSpeech } from '../src/services/responder';
import { buildCompanionSystemPrompt } from '../src/services/prompts';

describe('origin matcher', () => {
  const matches = createOriginMatcher(
    parseAllowedOrigins(' https://flare.app, https://*.flare-web.pages.dev ,,')
  );

  it('matches exact and wildcard entries case-insensitively', () => {
    expect(matches('https://flare.app')).toBe(true);
    expect(matches('HTTPS://FLARE.APP')).toBe(true);
    expect(matches('https://abc123.flare-web.pages.dev')).toBe(true);
  });

  it('rejects near misses', () => {
    expect(matches('https://flare.app.evil.com')).toBe(false);
    expect(matches('https://evil.flare-web.pages.dev.attacker.io')).toBe(false);
    expect(matches('http://flare.app')).toBe(false);
    expect(matches('https://a.b.flare-web.pages.dev')).toBe(false);
  });
});

describe('assistant turn parsing', () => {
  it('parses a complete payload', () => {
    expect(
      parseAssistantTurn(
        '{"reply":"Hey!","emotion":"excited","gesture":"laugh","title":" Big *News* "}'
      )
    ).toEqual({ reply: 'Hey!', emotion: 'excited', gesture: 'laugh', title: 'Big News' });
  });

  it('tolerates prose around the JSON object', () => {
    const turn = parseAssistantTurn(
      'Sure: {"reply":"Okay.","emotion":"neutral","gesture":"none"} done'
    );
    expect(turn.reply).toBe('Okay.');
    expect(turn.title).toBeNull();
  });

  it('falls back to the raw text when nothing parses', () => {
    const turn = parseAssistantTurn('```\nnot json\n```');
    expect(turn.emotion).toBe('neutral');
    expect(turn.reply.length).toBeGreaterThan(0);
  });

  it('strips markup a text-to-speech engine would read aloud', () => {
    expect(sanitiseSpeech('# Title\n\n**bold** and `code` > quote')).toBe(
      'Title bold and code quote'
    );
    expect(sanitiseSpeech('   ')).toMatch(/say that again/i);
  });
});

describe('companion prompt', () => {
  it('stays compact and only asks for a title when needed', () => {
    const withTitle = buildCompanionSystemPrompt({
      displayName: 'Ada',
      persona: 'warm',
      wantsTitle: true,
    });
    const withoutTitle = buildCompanionSystemPrompt({
      displayName: 'Ada',
      persona: 'calm',
      wantsTitle: false,
    });
    expect(withoutTitle).toContain('few words');
    expect(withTitle).toContain('"title"');
    expect(withoutTitle).not.toContain('"title"');
    expect(withTitle.length).toBeLessThan(700);
  });
});

describe('pagination cursor', () => {
  it('round-trips and rejects garbage', () => {
    const encoded = encodeCursor({ updatedAt: 1_700_000_123, id: 'abc-def' });
    expect(encoded).not.toMatch(/[+/=]/);
    expect(decodeCursor(encoded)).toEqual({ updatedAt: 1_700_000_123, id: 'abc-def' });
    expect(decodeCursor('not-a-cursor')).toBeNull();
    expect(decodeCursor(btoa('[1,2]'))).toBeNull();
  });
});
