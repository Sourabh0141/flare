import { describe, expect, it } from 'vitest';
import { speakableLanguage, voiceForLanguage } from '@flare/contracts';
import { decodeCursor, encodeCursor } from '@flare/db';
import { parseAllowedOrigins } from '../src/config/env';
import { createOriginMatcher } from '../src/middleware/cors';
import { buildCompanionSystemPrompt } from '../src/services/prompts';
import {
  HeaderParser,
  SentenceSplitter,
  parseHeaderFields,
  sanitiseSpeech,
} from '../src/services/responder';

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

describe('reply tag parsing', () => {
  it('reads emotion, gesture, intensity and title', () => {
    expect(parseHeaderFields('excited | laugh | 0.9 | Big *News*')).toEqual({
      expression: { emotion: 'excited', gesture: 'laugh', intensity: 0.9 },
      title: 'Big News',
    });
  });

  it('degrades unknown values to defaults and clamps intensity', () => {
    expect(parseHeaderFields('ecstatic|moonwalk|7')).toEqual({
      expression: { emotion: 'neutral', gesture: 'none', intensity: 1 },
      title: null,
    });
    expect(parseHeaderFields('sad|none|nope').expression.intensity).toBe(0.5);
  });

  it('assembles a tag that arrives in fragments and returns the remainder', () => {
    const parser = new HeaderParser();
    expect(parser.feed('[hap')).toBeNull();
    expect(parser.feed('py|nod|0')).toBeNull();
    const result = parser.feed('.6]\nHello there');
    expect(result?.header.expression).toEqual({ emotion: 'happy', gesture: 'nod', intensity: 0.6 });
    expect(result?.rest).toBe('Hello there');
  });

  it('gives up when the reply clearly has no tag', () => {
    const parser = new HeaderParser();
    const result = parser.feed('Hello, no tag here.');
    expect(result?.header.expression.emotion).toBe('neutral');
    expect(result?.rest).toBe('Hello, no tag here.');
  });
});

describe('sentence splitter', () => {
  it('emits sentences as their terminators arrive and flushes the tail', () => {
    const splitter = new SentenceSplitter();
    const out = [
      ...splitter.push('Hello there. How are'),
      ...splitter.push(' you today? Fine, I'),
      ...splitter.push(' hope'),
    ];
    expect(out).toEqual(['Hello there.', 'How are you today?']);
    expect(splitter.flush()).toEqual(['Fine, I hope']);
  });

  it('does not split on a period without trailing space, such as a decimal', () => {
    const splitter = new SentenceSplitter();
    expect(splitter.push('It costs 3.50 today. ')).toEqual(['It costs 3.50 today.']);
  });

  it('merges very short fragments into the next sentence', () => {
    const splitter = new SentenceSplitter();
    expect(splitter.push('Oh. Really now? ')).toEqual(['Oh. Really now?']);
  });

  it('handles CJK terminators without spaces', () => {
    const splitter = new SentenceSplitter();
    expect(splitter.push('こんにちは。元気ですか？')).toEqual(['こんにちは。', '元気ですか？']);
  });
});

describe('speech hygiene', () => {
  it('strips markup a text-to-speech engine would read aloud', () => {
    expect(sanitiseSpeech('# Title\n\n**bold** and `code` > quote')).toBe(
      'Title bold and code quote'
    );
    expect(sanitiseSpeech('   ')).toMatch(/say that again/i);
  });
});

describe('companion prompt', () => {
  it('names the language and only asks for a title when needed', () => {
    const withTitle = buildCompanionSystemPrompt({
      displayName: 'Ada',
      persona: 'warm',
      language: 'en',
      wantsTitle: true,
    });
    const withoutTitle = buildCompanionSystemPrompt({
      displayName: 'Ada',
      persona: 'calm',
      language: 'ja',
      wantsTitle: false,
    });
    expect(withTitle).toContain('|title]');
    expect(withTitle).toContain('plain English');
    expect(withoutTitle).not.toContain('title');
    expect(withoutTitle).toContain('plain Japanese');
    expect(withoutTitle).toContain('few words');
    expect(withTitle.length).toBeLessThan(800);
  });
});

describe('languages and voices', () => {
  it('normalises Whisper codes and falls back to English', () => {
    expect(speakableLanguage('es')).toBe('es');
    expect(speakableLanguage('pt-BR')).toBe('pt');
    expect(speakableLanguage('de')).toBe('en');
    expect(speakableLanguage(null)).toBe('en');
  });

  it('keeps the register of the chosen voice when switching language', () => {
    expect(voiceForLanguage('en', 'af_heart')).toBe('af_heart');
    expect(voiceForLanguage('ja', 'af_heart')).toBe('jf_alpha');
    expect(voiceForLanguage('ja', 'bm_george')).toBe('jm_kumo');
    expect(voiceForLanguage('de', 'bm_george')).toBe('bm_george');
  });
});

describe('pagination cursor', () => {
  it('round-trips and rejects garbage', () => {
    const encoded = encodeCursor({ pinned: true, updatedAt: 1_700_000_123, id: 'abc-def' });
    expect(encoded).not.toMatch(/[+/=]/);
    expect(decodeCursor(encoded)).toEqual({
      pinned: true,
      updatedAt: 1_700_000_123,
      id: 'abc-def',
    });
    expect(decodeCursor('not-a-cursor')).toBeNull();
    expect(decodeCursor(btoa('[1,2]'))).toBeNull();
  });
});
