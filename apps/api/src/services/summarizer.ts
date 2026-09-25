import {
  countLiveMessages,
  getConversationContext,
  getOldestLiveMessages,
  replaceWithSummary,
} from '@flare/db';
import type { Logger } from '../lib/logger.js';
import type { DeepInfraClient } from './deepinfra.js';
import { SUMMARY_SYSTEM_PROMPT, buildSummaryUserPrompt } from './prompts.js';

/** Once a conversation holds more than this many live messages, the oldest are folded in. */
export const SUMMARIZE_THRESHOLD = 20;
/** How many of the oldest messages each compaction folds into the summary. */
export const SUMMARIZE_BATCH_SIZE = 10;

export interface SummarizeInput {
  db: D1Database;
  conversationId: string;
  model: string;
  logger: Logger;
}

export type SummarizeOutcome =
  | { summarized: false; reason: 'below_threshold' | 'nothing_to_fold' }
  | { summarized: true; foldedMessages: number };

/**
 * Rolling compaction that keeps the LLM context bounded. Runs in the background after a
 * turn (`ctx.waitUntil`) so it never adds latency to the reply.
 */
export async function maybeSummarize(
  client: DeepInfraClient,
  input: SummarizeInput
): Promise<SummarizeOutcome> {
  const liveCount = await countLiveMessages(input.db, input.conversationId);
  if (liveCount <= SUMMARIZE_THRESHOLD) {
    return { summarized: false, reason: 'below_threshold' };
  }

  const oldest = await getOldestLiveMessages(input.db, input.conversationId, SUMMARIZE_BATCH_SIZE);
  if (oldest.length === 0) {
    return { summarized: false, reason: 'nothing_to_fold' };
  }

  const { summary: previous } = await getConversationContext(input.db, input.conversationId, 1);

  const result = await client.chat({
    model: input.model,
    messages: [
      { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
      { role: 'user', content: buildSummaryUserPrompt(previous?.content ?? null, oldest) },
    ],
    temperature: 0.2,
    maxTokens: 220,
  });

  await replaceWithSummary(
    input.db,
    input.conversationId,
    result.content,
    oldest.map((m) => m.id)
  );

  input.logger.info('summary.applied', {
    conversationId: input.conversationId,
    folded: oldest.length,
    usage: result.usage,
  });
  return { summarized: true, foldedMessages: oldest.length };
}
