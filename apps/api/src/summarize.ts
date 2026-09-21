import type { D1Database } from '@cloudflare/workers-types';
import {
  countNonSummaryMessages,
  getOldestNonSummaryMessages,
  applyConversationSummary,
  type Message,
} from '@flare/db';
import { generateChatCompletion, type ChatMessage } from './deepinfra.js';

export const SUMMARIZE_THRESHOLD = 20;
export const SUMMARIZE_BATCH_SIZE = 10;

export interface SummarizeOptions {
  model?: string;
}

export interface SummarizeResult {
  summarized: boolean;
  summary?: string;
  deletedMessageCount?: number;
  reason?: string;
}

const SUMMARIZER_SYSTEM_PROMPT = `You are a concise, accurate AI conversation summarizer.
Your job is to condense the provided conversation messages into a factual, structured bulleted summary.
Guidelines:
- Preserve all key user preferences, important facts, decisions, and discussion topics.
- Exclude conversational filler, greetings, and pleasantries.
- Keep the summary clear and concise (under 200 words).`;

/**
 * Checks if a conversation has exceeded the non-summary message threshold (20 messages).
 * If so, extracts the oldest 10 messages, summarizes them via LLM, and replaces them with a synthetic summary row in D1.
 */
export async function maybeTriggerSummarization(
  db: D1Database,
  conversationId: string,
  apiKey: string,
  options?: SummarizeOptions
): Promise<SummarizeResult> {
  // 1. Check non-summary message count
  const messageCount = await countNonSummaryMessages(db, conversationId);
  if (messageCount <= SUMMARIZE_THRESHOLD) {
    return {
      summarized: false,
      reason: `Message count (${messageCount}) does not exceed threshold (${SUMMARIZE_THRESHOLD}).`,
    };
  }

  // 2. Fetch the oldest 10 non-summary messages to summarize
  const oldestMessages = await getOldestNonSummaryMessages(db, conversationId, SUMMARIZE_BATCH_SIZE);
  if (oldestMessages.length === 0) {
    return {
      summarized: false,
      reason: 'No oldest messages found to summarize.',
    };
  }

  // 3. Fetch any existing prior summary message
  const priorSummary = await db
    .prepare(
      "SELECT id, conversation_id, role, content, created_at FROM messages WHERE conversation_id = ? AND role = 'summary' ORDER BY created_at DESC LIMIT 1"
    )
    .bind(conversationId)
    .first<Message>();

  // 4. Construct messages prompt for LLM
  const messagesToSummarizeText = oldestMessages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n');

  let userPrompt = '';
  if (priorSummary && priorSummary.content) {
    userPrompt = `Previous Summary:\n${priorSummary.content}\n\nNew Messages to Merge:\n${messagesToSummarizeText}\n\nProvide an updated, unified summary combining the previous summary and the new messages.`;
  } else {
    userPrompt = `Messages to Summarize:\n${messagesToSummarizeText}\n\nProvide a concise summary of these conversation messages.`;
  }

  const llmMessages: ChatMessage[] = [
    {
      role: 'system',
      content: SUMMARIZER_SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: userPrompt,
    },
  ];

  // 5. Generate summary using DeepInfra LLM
  const summaryContent = await generateChatCompletion(apiKey, llmMessages, {
    model: options?.model,
    temperature: 0.3,
    maxTokens: 250,
  });

  if (!summaryContent || summaryContent.trim().length === 0) {
    return {
      summarized: false,
      reason: 'LLM generated an empty summary.',
    };
  }

  // 6. Atomically replace the 10 messages with the summary row in D1
  const messageIdsToDelete = oldestMessages.map((m) => m.id);
  await applyConversationSummary(db, conversationId, summaryContent.trim(), messageIdsToDelete);

  return {
    summarized: true,
    summary: summaryContent.trim(),
    deletedMessageCount: messageIdsToDelete.length,
  };
}
