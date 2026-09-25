import {
  apiErrorBodySchema,
  conversationDetailResponseSchema,
  listConversationsResponseSchema,
  respondResponseSchema,
  settingsResponseSchema,
  transcribeResponseSchema,
  updateConversationResponseSchema,
  type ApiErrorCode,
  type Conversation,
  type ConversationDetailResponse,
  type ListConversationsResponse,
  type RespondRequest,
  type RespondResponse,
  type TranscribeResponse,
  type User,
} from '@flare/contracts';
import type { ZodType } from 'zod';
import { config } from '../config';

export type TokenProvider = () => Promise<string | null>;

/** Error thrown for any non-2xx response, network failure, or malformed payload. */
export class ApiClientError extends Error {
  readonly code: ApiErrorCode | 'network' | 'aborted' | 'invalid_response';
  readonly status: number | null;
  readonly requestId: string | null;

  constructor(
    code: ApiClientError['code'],
    message: string,
    options: { status?: number | null; requestId?: string | null; cause?: unknown } = {}
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = options.status ?? null;
    this.requestId = options.requestId ?? null;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  json?: unknown;
  body?: BodyInit;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * Typed client for the Flare API. Every response is validated against the shared contract
 * so a server change that breaks the shape fails loudly here rather than deep in the UI.
 */
export class ApiClient {
  constructor(
    private readonly getToken: TokenProvider,
    private readonly baseUrl: string = config.apiBaseUrl
  ) {}

  async getSettings(signal?: AbortSignal): Promise<User> {
    const data = await this.request('/api/settings', settingsResponseSchema, { signal });
    return data.user;
  }

  async updateDisplayName(displayName: string): Promise<User> {
    const data = await this.request('/api/settings', settingsResponseSchema, {
      method: 'PATCH',
      json: { displayName },
    });
    return data.user;
  }

  async listConversations(
    options: { limit?: number; cursor?: string | null } = {},
    signal?: AbortSignal
  ): Promise<ListConversationsResponse> {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', String(options.limit));
    if (options.cursor) params.set('cursor', options.cursor);
    const query = params.size > 0 ? `?${params.toString()}` : '';
    return this.request(`/api/conversations${query}`, listConversationsResponseSchema, { signal });
  }

  async getConversation(id: string, signal?: AbortSignal): Promise<ConversationDetailResponse> {
    return this.request(
      `/api/conversations/${encodeURIComponent(id)}`,
      conversationDetailResponseSchema,
      {
        signal,
      }
    );
  }

  async renameConversation(id: string, title: string): Promise<Conversation> {
    const data = await this.request(
      `/api/conversations/${encodeURIComponent(id)}`,
      updateConversationResponseSchema,
      { method: 'PATCH', json: { title } }
    );
    return data.conversation;
  }

  async deleteConversation(id: string): Promise<void> {
    await this.send(`/api/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async transcribe(audio: Blob, signal?: AbortSignal): Promise<TranscribeResponse> {
    return this.request('/api/turns/transcribe', transcribeResponseSchema, {
      method: 'POST',
      body: audio,
      headers: { 'content-type': audio.type || 'audio/webm' },
      signal,
    });
  }

  async respond(input: RespondRequest, signal?: AbortSignal): Promise<RespondResponse> {
    return this.request('/api/turns/respond', respondResponseSchema, {
      method: 'POST',
      json: input,
      signal,
    });
  }

  /** Downloads the synthesized speech for an assistant message. */
  async fetchMessageAudio(messageId: string, signal?: AbortSignal): Promise<Blob> {
    const response = await this.send(`/api/messages/${encodeURIComponent(messageId)}/audio`, {
      signal,
    });
    return response.blob();
  }

  private async request<T>(
    path: string,
    schema: ZodType<T>,
    options: RequestOptions = {}
  ): Promise<T> {
    const response = await this.send(path, options);
    let payload: unknown;
    try {
      payload = await response.json();
    } catch (cause) {
      throw new ApiClientError('invalid_response', 'The server sent an unreadable response.', {
        status: response.status,
        cause,
      });
    }
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new ApiClientError('invalid_response', 'The server sent an unexpected response.', {
        status: response.status,
        cause: parsed.error,
      });
    }
    return parsed.data;
  }

  private async send(path: string, options: RequestOptions = {}): Promise<Response> {
    const token = await this.getToken();
    if (!token) {
      throw new ApiClientError(
        'unauthorized',
        'Your session has ended. Sign in again to continue.'
      );
    }

    const headers = new Headers(options.headers);
    headers.set('authorization', `Bearer ${token}`);
    let body = options.body;
    if (options.json !== undefined) {
      headers.set('content-type', 'application/json');
      body = JSON.stringify(options.json);
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: options.method ?? (body ? 'POST' : 'GET'),
        headers,
        ...(body !== undefined ? { body } : {}),
        ...(options.signal ? { signal: options.signal } : {}),
      });
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') {
        throw new ApiClientError('aborted', 'Request cancelled.', { cause });
      }
      throw new ApiClientError('network', "Can't reach Flare right now. Check your connection.", {
        cause,
      });
    }

    if (!response.ok) {
      throw await toApiClientError(response);
    }
    return response;
  }
}

async function toApiClientError(response: Response): Promise<ApiClientError> {
  const requestId = response.headers.get('x-request-id');
  let parsedBody: unknown = null;
  try {
    parsedBody = await response.json();
  } catch {
    // Non-JSON error body; fall through to a status-based message.
  }
  const contract = apiErrorBodySchema.safeParse(parsedBody);
  if (contract.success) {
    return new ApiClientError(contract.data.error.code, contract.data.error.message, {
      status: response.status,
      requestId: contract.data.error.requestId ?? requestId,
    });
  }
  return new ApiClientError('network', `Request failed with status ${response.status}.`, {
    status: response.status,
    requestId,
  });
}

/** Copy for the interface: what went wrong and what to do about it. */
export function describeError(error: unknown): string {
  if (error instanceof ApiClientError) {
    switch (error.code) {
      case 'no_speech_detected':
        return "Flare couldn't hear anything. Hold the button a moment longer and speak clearly.";
      case 'rate_limited':
        return 'Slow down a little. Flare can take another turn in about a minute.';
      case 'payload_too_large':
        return 'That recording was too long. Keep each turn under a minute.';
      case 'unauthorized':
        return 'Your session has ended. Sign in again to continue.';
      case 'upstream_timeout':
        return 'Flare took too long to answer. Try that once more.';
      case 'upstream_error':
      case 'not_configured':
      case 'internal_error':
        return "Flare's voice services are having trouble. Try again shortly.";
      case 'network':
        return "Can't reach Flare right now. Check your connection and try again.";
      case 'aborted':
        return 'Cancelled.';
      default:
        return error.message;
    }
  }
  if (error instanceof Error) return error.message;
  return 'Something unexpected happened.';
}
