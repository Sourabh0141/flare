import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  maybeTriggerSummarization,
  SUMMARIZE_THRESHOLD,
  SUMMARIZE_BATCH_SIZE,
} from '../src/summarize.js';
import {
  insertMessage,
  countNonSummaryMessages,
  getConversationMessages,
  getConversationContext,
} from '@flare/db';

// Mock DeepInfra generateChatCompletion for summarization
vi.mock('../src/deepinfra.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/deepinfra.js')>();
  return {
    ...actual,
    generateChatCompletion: vi.fn().mockImplementation(async (apiKey, messages, options) => {
      const userMsg = messages.find((m: { role: string }) => m.role === 'user')?.content || '';
      if (userMsg.includes('Previous Summary:')) {
        return 'Updated summary: User discussed React bugs and planned a Goa trip.';
      }
      return 'Summary: User discussed healthy oatmeal recipes and cooking tips.';
    }),
  };
});

// Mock in-memory D1 Database implementation
function createMockDb() {
  const conversations = new Map<string, { id: string; user_id: string; title: string; created_at: number; updated_at: number }>();
  const messages = new Map<string, { id: string; conversation_id: string; role: string; content: string; created_at: number }>();

  return {
    prepare: (query: string) => {
      let boundParams: any[] = [];
      const statement = {
        bind: (...params: any[]) => {
          boundParams = params;
          return statement;
        },
        first: async <T = unknown>(): Promise<T | null> => {
          if (query.includes("COUNT(*) as count FROM messages WHERE conversation_id = ? AND role != 'summary'")) {
            const count = Array.from(messages.values()).filter(
              (m) => m.conversation_id === boundParams[0] && m.role !== 'summary'
            ).length;
            return { count } as unknown as T;
          }
          if (query.includes("SELECT id, conversation_id, role, content, created_at FROM messages WHERE conversation_id = ? AND role = 'summary'")) {
            const summaries = Array.from(messages.values())
              .filter((m) => m.conversation_id === boundParams[0] && m.role === 'summary')
              .sort((a, b) => b.created_at - a.created_at);
            return (summaries[0] as unknown as T) || null;
          }
          return null;
        },
        all: async <T = unknown>(): Promise<{ results: T[] }> => {
          if (query.includes("FROM messages WHERE conversation_id = ? AND role != 'summary' ORDER BY created_at ASC")) {
            const limit = boundParams[1] || 100;
            const msgs = Array.from(messages.values())
              .filter((m) => m.conversation_id === boundParams[0] && m.role !== 'summary')
              .sort((a, b) => a.created_at - b.created_at)
              .slice(0, limit);
            return { results: msgs as unknown as T[] };
          }
          if (query.includes('FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')) {
            const msgs = Array.from(messages.values())
              .filter((m) => m.conversation_id === boundParams[0])
              .sort((a, b) => a.created_at - b.created_at);
            return { results: msgs as unknown as T[] };
          }
          return { results: [] };
        },
        run: async () => {
          if (query.includes('INSERT INTO messages')) {
            messages.set(boundParams[0], {
              id: boundParams[0],
              conversation_id: boundParams[1],
              role: boundParams[2],
              content: boundParams[3],
              created_at: boundParams[4],
            });
            return { meta: { changes: 1 } };
          }
          if (query.includes('DELETE FROM messages WHERE id = ? AND conversation_id = ?')) {
            const msgId = boundParams[0];
            if (messages.has(msgId)) {
              messages.delete(msgId);
              return { meta: { changes: 1 } };
            }
            return { meta: { changes: 0 } };
          }
          if (query.includes('UPDATE conversations SET updated_at = ? WHERE id = ?')) {
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 1 } };
        },
      };
      return statement;
    },
    batch: async (statements: any[]) => {
      const results = [];
      for (const stmt of statements) {
        results.push(await stmt.run());
      }
      return results;
    },
    _getAllMessages: () => Array.from(messages.values()),
  };
}

describe('Unit 6: Background Summarization (Requirements R33, R34, R35)', () => {
  let mockDb: any;
  const conversationId = 'test_conv_summary_123';
  const apiKey = 'test_deepinfra_key';

  beforeEach(() => {
    mockDb = createMockDb();
  });

  it('does not trigger summarization when message count <= 20', async () => {
    // Insert 18 non-summary messages
    for (let i = 1; i <= 18; i++) {
      await insertMessage(mockDb, {
        id: `msg_${i}`,
        conversationId,
        role: i % 2 === 1 ? 'user' : 'assistant',
        content: `Message ${i} content`,
      });
    }

    const countBefore = await countNonSummaryMessages(mockDb, conversationId);
    expect(countBefore).toBe(18);

    const result = await maybeTriggerSummarization(mockDb, conversationId, apiKey);
    expect(result.summarized).toBe(false);

    const countAfter = await countNonSummaryMessages(mockDb, conversationId);
    expect(countAfter).toBe(18);

    const allMessages = mockDb._getAllMessages();
    const summaryMsg = allMessages.find((m: any) => m.role === 'summary');
    expect(summaryMsg).toBeUndefined();
  });

  it('triggers summarization when message count reaches 21 (R33, R34)', async () => {
    // Insert 21 non-summary messages
    for (let i = 1; i <= 21; i++) {
      await insertMessage(mockDb, {
        id: `msg_${i}`,
        conversationId,
        role: i % 2 === 1 ? 'user' : 'assistant',
        content: `Message ${i} discussion details`,
      });
    }

    const countBefore = await countNonSummaryMessages(mockDb, conversationId);
    expect(countBefore).toBe(21);

    const result = await maybeTriggerSummarization(mockDb, conversationId, apiKey);
    expect(result.summarized).toBe(true);
    expect(result.deletedMessageCount).toBe(SUMMARIZE_BATCH_SIZE); // 10 messages deleted
    expect(result.summary).toContain('User discussed healthy oatmeal recipes');

    // Verify non-summary count is now 21 - 10 = 11
    const countAfter = await countNonSummaryMessages(mockDb, conversationId);
    expect(countAfter).toBe(11);

    // Verify the oldest 10 messages (msg_1 to msg_10) were deleted
    const allMessages = mockDb._getAllMessages();
    for (let i = 1; i <= 10; i++) {
      expect(allMessages.find((m: any) => m.id === `msg_${i}`)).toBeUndefined();
    }

    // Verify messages msg_11 to msg_21 are preserved
    for (let i = 11; i <= 21; i++) {
      expect(allMessages.find((m: any) => m.id === `msg_${i}`)).toBeDefined();
    }

    // Verify summary row was created
    const summaryMsg = allMessages.find((m: any) => m.role === 'summary');
    expect(summaryMsg).toBeDefined();
    expect(summaryMsg.content).toContain('User discussed healthy oatmeal recipes');
  });

  it('correctly builds context window with summary first, followed by recent messages (R35)', async () => {
    // 1. Insert 21 messages and trigger first summarization
    for (let i = 1; i <= 21; i++) {
      await insertMessage(mockDb, {
        id: `msg_${i}`,
        conversationId,
        role: i % 2 === 1 ? 'user' : 'assistant',
        content: `Message ${i} content`,
      });
    }

    await maybeTriggerSummarization(mockDb, conversationId, apiKey);

    // 2. Query conversation context via getConversationContext
    const context = await getConversationContext(mockDb, conversationId);

    expect(context.summary).toBeDefined();
    expect(context.summary?.role).toBe('summary');
    expect(context.summary?.content).toContain('User discussed healthy oatmeal recipes');

    // 3. Verify messages contains remaining 11 non-summary messages
    expect(context.messages.length).toBe(11);
    expect(context.messages[0].id).toBe('msg_11');
    expect(context.messages[10].id).toBe('msg_21');
  });

  it('merges existing summary when summarization triggers a second time', async () => {
    // 1. Insert 21 messages and summarize
    for (let i = 1; i <= 21; i++) {
      await insertMessage(mockDb, {
        id: `msg_${i}`,
        conversationId,
        role: i % 2 === 1 ? 'user' : 'assistant',
        content: `Message ${i} content`,
      });
    }
    await maybeTriggerSummarization(mockDb, conversationId, apiKey);

    // 2. Add 10 more messages (total now 11 + 10 = 21 again)
    for (let i = 22; i <= 31; i++) {
      await insertMessage(mockDb, {
        id: `msg_${i}`,
        conversationId,
        role: i % 2 === 1 ? 'user' : 'assistant',
        content: `Message ${i} content`,
      });
    }

    const countBeforeSecond = await countNonSummaryMessages(mockDb, conversationId);
    expect(countBeforeSecond).toBe(21);

    // 3. Trigger second summarization
    const secondResult = await maybeTriggerSummarization(mockDb, conversationId, apiKey);
    expect(secondResult.summarized).toBe(true);
    expect(secondResult.summary).toContain('Updated summary');

    // Non-summary messages should be 21 - 10 = 11 again (msg_21 to msg_31)
    const countAfterSecond = await countNonSummaryMessages(mockDb, conversationId);
    expect(countAfterSecond).toBe(11);
  });
});
