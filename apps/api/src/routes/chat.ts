import { Hono } from 'hono';
import {
  getConversation,
  createConversation,
  isConversationInactive,
  insertMessage,
  getConversationContext,
  updateConversationTitle,
} from '@flare/db';
import {
  transcribeAudio,
  generateChatCompletion,
  generateConversationTitle,
  synthesizeSpeech,
  type ChatMessage,
} from '../deepinfra.js';
import type { AppEnv } from '../types.js';

export const chatRoutes = new Hono<AppEnv>();

const SYSTEM_PROMPT = `You are Flare, a charismatic, intelligent, and concise AI companion.
You are speaking out loud to the user in a voice conversation.
Keep your responses conversational, warm, and concise (1 to 3 spoken sentences).
Never use markdown formatting, bullet points, asterisks, emoji, or lists, as your output is converted directly to speech.`;

/**
 * POST /api/chat - Process a voice conversation turn (ASR -> LLM -> TTS).
 * Accepts multipart/form-data containing 'audio' file and optional 'conversationId'.
 * Returns streaming binary audio response with conversation metadata in headers.
 */
chatRoutes.post('/', async (c) => {
  const userId = c.get('userId');

  const apiKey = c.env.DEEPINFRA_API_KEY;
  if (!apiKey) {
    return c.json(
      {
        error: 'InternalServerError',
        message: 'DeepInfra API key is not configured.',
      },
      500
    );
  }

  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json(
      {
        error: 'BadRequest',
        message: 'Invalid multipart/form-data payload.',
      },
      400
    );
  }

  const audioFile = formData.get('audio');
  if (!audioFile || typeof audioFile === 'string' || (audioFile as Blob).size === 0) {
    return c.json(
      {
        error: 'BadRequest',
        message: 'A non-empty audio file is required in field "audio".',
      },
      400
    );
  }

  const requestedConversationId = formData.get('conversationId');
  let activeConversationId: string;
  let isNewConversation = false;

  // Resolve or create conversation thread
  if (typeof requestedConversationId === 'string' && requestedConversationId.trim().length > 0) {
    const trimmedId = requestedConversationId.trim();
    const existingConv = await getConversation(c.env.DB, trimmedId, userId);
    const isInactive = await isConversationInactive(c.env.DB, trimmedId, 30);

    if (!existingConv || isInactive) {
      // If conversation doesn't exist, is not owned by user, or inactive for >30m, branch a new conversation
      const newConv = await createConversation(c.env.DB, { userId });
      activeConversationId = newConv.id;
      isNewConversation = true;
    } else {
      activeConversationId = existingConv.id;
      isNewConversation = false;
    }
  } else {
    const newConv = await createConversation(c.env.DB, { userId });
    activeConversationId = newConv.id;
    isNewConversation = true;
  }

  // Enforce 25-second timeout on DeepInfra requests
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), 25000);

  try {
    // -------------------------------------------------------------------------
    // 1. ASR Transcription (Whisper)
    // -------------------------------------------------------------------------
    const userTranscript = await transcribeAudio(apiKey, audioFile, {
      model: c.env.DEEPINFRA_STT_MODEL,
      signal: abortController.signal,
    });

    if (!userTranscript || userTranscript.trim().length === 0) {
      return c.json(
        {
          error: 'BadRequest',
          message: 'No audible speech detected in the audio recording.',
        },
        400
      );
    }

    // Persist user transcript in D1
    await insertMessage(c.env.DB, {
      conversationId: activeConversationId,
      role: 'user',
      content: userTranscript,
    });

    // -------------------------------------------------------------------------
    // 2. Fetch Conversation Context & LLM Chat Reasoning
    // -------------------------------------------------------------------------
    const context = await getConversationContext(c.env.DB, activeConversationId);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
    ];

    if (context.summary) {
      messages.push({
        role: 'system',
        content: `Previous conversation summary: ${context.summary.content}`,
      });
    }

    for (const msg of context.messages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    const assistantResponse = await generateChatCompletion(apiKey, messages, {
      model: c.env.DEEPINFRA_LLM_MODEL,
      signal: abortController.signal,
    });

    // Persist assistant response in D1
    await insertMessage(c.env.DB, {
      conversationId: activeConversationId,
      role: 'assistant',
      content: assistantResponse,
    });

    // -------------------------------------------------------------------------
    // 3. Auto-generate Title for New Conversations
    // -------------------------------------------------------------------------
    if (isNewConversation || context.messages.length <= 2) {
      const generatedTitle = await generateConversationTitle(
        apiKey,
        userTranscript,
        assistantResponse,
        {
          model: c.env.DEEPINFRA_LLM_MODEL,
          signal: abortController.signal,
        }
      );

      if (generatedTitle && generatedTitle !== 'New conversation') {
        await updateConversationTitle(c.env.DB, activeConversationId, userId, generatedTitle);
      }
    }

    // -------------------------------------------------------------------------
    // 4. TTS Speech Synthesis
    // -------------------------------------------------------------------------
    const { audioBuffer, contentType } = await synthesizeSpeech(apiKey, assistantResponse, {
      model: c.env.DEEPINFRA_TTS_MODEL,
      voice: c.env.DEEPINFRA_TTS_VOICE,
      signal: abortController.signal,
    });

    // -------------------------------------------------------------------------
    // 5. Return Binary Audio Payload
    // -------------------------------------------------------------------------
    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'X-Conversation-Id': activeConversationId,
        'X-User-Transcript': encodeURIComponent(userTranscript),
        'X-Assistant-Response': encodeURIComponent(assistantResponse),
        'Access-Control-Expose-Headers':
          'X-Conversation-Id, X-User-Transcript, X-Assistant-Response',
      },
    });
  } catch (error: unknown) {
    console.error('DeepInfra Turn Pipeline Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown AI processing error';

    return c.json(
      {
        error: 'ServiceUnavailable',
        message: 'Failed to process conversation turn with AI provider.',
        details: message,
      },
      503
    );
  } finally {
    clearTimeout(timeoutId);
  }
});
