/**
 * DeepInfra AI Client Integration
 * Handles Speech-to-Text (ASR), LLM Chat Reasoning, Title Generation, and Text-to-Speech (TTS).
 */

export const DEFAULT_STT_MODEL = 'openai/whisper-large-v3-turbo';
export const DEFAULT_LLM_MODEL = 'meta-llama/Meta-Llama-3.1-8B-Instruct';
export const DEFAULT_TTS_MODEL = 'hexgrad/Kokoro-82M';
export const DEFAULT_TTS_VOICE = 'af_heart';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface TranscribeOptions {
  model?: string;
  signal?: AbortSignal;
}

export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface TitleOptions {
  model?: string;
  signal?: AbortSignal;
}

export interface SynthesizeOptions {
  model?: string;
  voice?: string;
  outputFormat?: string;
  signal?: AbortSignal;
}

export interface SynthesizeResult {
  audioBuffer: ArrayBuffer;
  contentType: string;
}

/**
 * Transcribes audio using DeepInfra Whisper ASR.
 */
export async function transcribeAudio(
  apiKey: string,
  audioData: Blob | File | ArrayBuffer,
  options?: TranscribeOptions
): Promise<string> {
  const model = options?.model || DEFAULT_STT_MODEL;
  const url = `https://api.deepinfra.com/v1/inference/${model}`;

  const formData = new FormData();
  if (audioData instanceof ArrayBuffer) {
    formData.append('audio', new Blob([audioData], { type: 'audio/wav' }), 'audio.wav');
  } else {
    formData.append('audio', audioData);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
    signal: options?.signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`DeepInfra ASR error (${response.status}): ${errorText}`);
  }

  const result = (await response.json()) as { text?: string };
  return (result.text || '').trim();
}

/**
 * Generates an assistant response using DeepInfra OpenAI-compatible Chat Completions.
 */
export async function generateChatCompletion(
  apiKey: string,
  messages: ChatMessage[],
  options?: ChatCompletionOptions
): Promise<string> {
  const model = options?.model || DEFAULT_LLM_MODEL;
  const url = 'https://api.deepinfra.com/v1/openai/chat/completions';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 300,
    }),
    signal: options?.signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`DeepInfra LLM error (${response.status}): ${errorText}`);
  }

  const result = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = result.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('DeepInfra LLM returned empty response choices.');
  }

  return content.trim();
}

/**
 * Generates a concise title for a new conversation based on the first turn.
 */
export async function generateConversationTitle(
  apiKey: string,
  userText: string,
  assistantText: string,
  options?: TitleOptions
): Promise<string> {
  const model = options?.model || DEFAULT_LLM_MODEL;
  const url = 'https://api.deepinfra.com/v1/openai/chat/completions';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              'Generate a concise, descriptive title (3 to 5 words max) for this conversation exchange. Output ONLY the title text, with no quotes, formatting, or punctuation.',
          },
          {
            role: 'user',
            content: `User: ${userText}\nAssistant: ${assistantText}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 30,
      }),
      signal: options?.signal,
    });

    if (!response.ok) {
      return 'New conversation';
    }

    const result = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const title = result.choices?.[0]?.message?.content?.replace(/["'*]/g, '').trim();
    return title && title.length > 0 ? title.substring(0, 60) : 'New conversation';
  } catch {
    return 'New conversation';
  }
}

/**
 * Synthesizes text into speech audio bytes using DeepInfra TTS.
 */
export async function synthesizeSpeech(
  apiKey: string,
  text: string,
  options?: SynthesizeOptions
): Promise<SynthesizeResult> {
  const model = options?.model || DEFAULT_TTS_MODEL;
  const voice = options?.voice || DEFAULT_TTS_VOICE;
  const outputFormat = options?.outputFormat || 'mp3';
  const url = `https://api.deepinfra.com/v1/inference/${model}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      voice,
      output_format: outputFormat,
    }),
    signal: options?.signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`DeepInfra TTS error (${response.status}): ${errorText}`);
  }

  const audioBuffer = await response.arrayBuffer();
  const contentType = response.headers.get('content-type') || 'audio/mpeg';

  return {
    audioBuffer,
    contentType,
  };
}
