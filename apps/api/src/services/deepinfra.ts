import { ApiError } from '../lib/errors';
import { isTimeoutError, timeoutSignal } from '../lib/timeout';

/**
 * Thin client for DeepInfra's OpenAI-compatible endpoints. Every call is bounded by a
 * timeout, and failures are normalised to `upstream_error` / `upstream_timeout` so routes
 * never leak provider internals.
 */

const BASE_URL = 'https://api.deepinfra.com/v1/openai';

export interface DeepInfraClientOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  timeoutMs?: number;
}

export interface ChatCompletionResult {
  content: string;
  usage: { promptTokens: number; completionTokens: number } | null;
}

export interface TranscriptionRequest {
  model: string;
  audio: Blob;
  filename: string;
  timeoutMs?: number;
}

export interface TranscriptionResult {
  text: string;
  language: string | null;
}

export interface SpeechRequest {
  model: string;
  voice: string;
  text: string;
  timeoutMs?: number;
  /** Aborts the upstream request if the client goes away while audio is streaming. */
  signal?: AbortSignal;
}

export interface SpeechResult {
  body: ReadableStream<Uint8Array>;
  contentType: string;
}

export class DeepInfraClient {
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: DeepInfraClientOptions) {
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResult> {
    const form = new FormData();
    form.append('file', request.audio, request.filename);
    form.append('model', request.model);
    form.append('response_format', 'json');

    const response = await this.send(
      '/audio/transcriptions',
      { method: 'POST', body: form },
      request.timeoutMs ?? 20_000,
      'transcription'
    );

    const data = (await response.json()) as { text?: unknown; language?: unknown };
    return {
      text: typeof data.text === 'string' ? data.text.trim() : '',
      language: typeof data.language === 'string' ? data.language : null,
    };
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResult> {
    const response = await this.send(
      '/chat/completions',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 256,
          ...(request.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
      },
      request.timeoutMs ?? 20_000,
      'chat completion'
    );

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new ApiError('upstream_error', 'The language model returned an empty response.');
    }

    return {
      content: content.trim(),
      usage:
        data.usage && typeof data.usage.prompt_tokens === 'number'
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens ?? 0,
            }
          : null,
    };
  }

  /**
   * Text-to-speech. The response body is returned as a stream so the route can pipe it to
   * the client without buffering the whole file in the Worker.
   */
  async speak(request: SpeechRequest): Promise<SpeechResult> {
    const response = await this.send(
      '/audio/speech',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: request.model,
          input: request.text,
          voice: request.voice,
          response_format: 'mp3',
        }),
        ...(request.signal ? { signal: request.signal } : {}),
      },
      request.timeoutMs ?? 25_000,
      'speech synthesis',
      // The timeout must not abort the stream after headers arrive.
      { releaseOnHeaders: true }
    );

    if (!response.body) {
      throw new ApiError('upstream_error', 'Speech synthesis returned no audio.');
    }

    return {
      body: response.body,
      contentType: response.headers.get('content-type') ?? 'audio/mpeg',
    };
  }

  private async send(
    path: string,
    init: RequestInit,
    timeoutMs: number,
    operation: string,
    options: { releaseOnHeaders?: boolean } = {}
  ): Promise<Response> {
    const parentSignal = init.signal instanceof AbortSignal ? init.signal : undefined;
    const { signal, release } = timeoutSignal(timeoutMs, parentSignal);
    const headers = new Headers(init.headers);
    headers.set('authorization', `Bearer ${this.apiKey}`);

    let response: Response;
    try {
      response = await this.fetchImpl(`${BASE_URL}${path}`, { ...init, headers, signal });
    } catch (error) {
      release();
      if (isTimeoutError(error)) {
        throw new ApiError(
          'upstream_timeout',
          `The ${operation} service took too long to respond.`,
          {
            cause: error,
          }
        );
      }
      throw new ApiError('upstream_error', `Could not reach the ${operation} service.`, {
        cause: error,
      });
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      release();
      throw new ApiError('upstream_error', `The ${operation} service rejected the request.`, {
        details: { status: response.status, body: detail.slice(0, 500) },
        expose: false,
      });
    }

    if (options.releaseOnHeaders) {
      release();
    } else {
      // Body reads happen in the caller; keep the timer alive until they complete by
      // wrapping the response in one that releases when consumed.
      response = withRelease(response, release);
    }
    return response;
  }
}

function withRelease(response: Response, release: () => void): Response {
  const proxied = new Response(response.body, response);
  const originalJson = proxied.json.bind(proxied);
  proxied.json = async () => {
    try {
      return await originalJson();
    } finally {
      release();
    }
  };
  return proxied;
}
