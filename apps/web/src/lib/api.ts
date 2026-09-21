/**
 * Flare API Client
 * Type-safe interface for communicating with the Cloudflare Worker API.
 */

export interface UserProfile {
  id: string;
  display_name: string;
  created_at: number;
  updated_at: number;
}

export interface ConversationItem {
  id: string;
  user_id: string;
  title: string;
  created_at: number;
  updated_at: number;
}

export interface MessageItem {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'summary';
  content: string;
  created_at: number;
}

export interface ConversationDetailsResponse {
  conversation: ConversationItem;
  messages: MessageItem[];
}

export interface SettingsResponse {
  user: UserProfile;
}

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');

/**
 * Common fetch helper attaching Clerk bearer token.
 */
async function fetchWithAuth<T>(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = new Headers(options.headers || {});

  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `API Request failed with status ${response.status}`;
    try {
      const errorJson = (await response.json()) as { error?: string; message?: string };
      errorMessage = errorJson.message || errorJson.error || errorMessage;
    } catch {
      // Non-JSON response
    }
    throw new Error(errorMessage);
  }

  return (await response.json()) as T;
}

// =============================================================================
// Settings API
// =============================================================================

export async function fetchSettings(token: string): Promise<UserProfile> {
  const data = await fetchWithAuth<SettingsResponse>('/api/settings', token, {
    method: 'GET',
  });
  return data.user;
}

export async function updateSettings(token: string, displayName: string): Promise<UserProfile> {
  const data = await fetchWithAuth<SettingsResponse>('/api/settings', token, {
    method: 'PATCH',
    body: JSON.stringify({ displayName }),
  });
  return data.user;
}

// =============================================================================
// Conversations API
// =============================================================================

export async function fetchConversations(token: string): Promise<ConversationItem[]> {
  const data = await fetchWithAuth<{ conversations: ConversationItem[] }>('/api/conversations', token, {
    method: 'GET',
  });
  return data.conversations || [];
}

export async function fetchConversationDetails(
  token: string,
  conversationId: string
): Promise<ConversationDetailsResponse> {
  return await fetchWithAuth<ConversationDetailsResponse>(`/api/conversations/${conversationId}`, token, {
    method: 'GET',
  });
}

export async function renameConversation(
  token: string,
  conversationId: string,
  title: string
): Promise<ConversationItem> {
  const data = await fetchWithAuth<{ success: boolean; conversation: ConversationItem }>(
    `/api/conversations/${conversationId}`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    }
  );
  return data.conversation;
}

export async function deleteConversation(
  token: string,
  conversationId: string
): Promise<void> {
  await fetchWithAuth<{ success: boolean }>(`/api/conversations/${conversationId}`, token, {
    method: 'DELETE',
  });
}

// =============================================================================
// Voice Turn (POST /api/chat)
// =============================================================================

export interface VoiceTurnResult {
  audioBlob: Blob;
  conversationId: string;
  userTranscript: string;
  assistantResponse: string;
}

export async function sendVoiceTurn(
  token: string,
  audioBlob: Blob,
  conversationId?: string | null
): Promise<VoiceTurnResult> {
  const url = `${API_BASE_URL}/api/chat`;
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.wav');
  if (conversationId) {
    formData.append('conversationId', conversationId);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    let errorMessage = `Turn processing failed (${response.status})`;
    try {
      const errorJson = (await response.json()) as { error?: string; message?: string };
      errorMessage = errorJson.message || errorJson.error || errorMessage;
    } catch {
      // Ignored
    }
    throw new Error(errorMessage);
  }

  const responseAudioBlob = await response.blob();
  const returnedConversationId = response.headers.get('X-Conversation-Id') || conversationId || '';
  const userTranscript = decodeURIComponent(response.headers.get('X-User-Transcript') || '');
  const assistantResponse = decodeURIComponent(response.headers.get('X-Assistant-Response') || '');

  return {
    audioBlob: responseAudioBlob,
    conversationId: returnedConversationId,
    userTranscript,
    assistantResponse,
  };
}
