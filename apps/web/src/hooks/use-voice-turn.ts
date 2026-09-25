'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ApiClientError, describeError } from '@/lib/api/client';
import { AudioCache } from '@/lib/audio/audio-cache';
import { getVoicePlayer } from '@/lib/audio/player';
import { classifyRecording, VoiceRecorder } from '@/lib/audio/recorder';
import { FALLBACK_AUDIO_URL } from '@/lib/config';
import { useAssistantStore } from '@/stores/assistant-store';
import { useConversationStore } from '@/stores/conversation-store';
import { useApiClient } from './use-api-client';

/**
 * The push-to-talk turn: record, transcribe, respond, speak. Each stage updates the
 * assistant state so the character and controls follow along, and everything in flight
 * can be interrupted by the user at any moment.
 */
export function useVoiceTurn() {
  const api = useApiClient();
  const assistant = useAssistantStore;
  const conversations = useConversationStore;
  const cache = useMemo(() => new AudioCache(), []);
  const recorderRef = useRef<VoiceRecorder | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  const turnSeq = useRef(0);
  // The recorder's max-duration callback is created before stopAndSend exists.
  const stopAndSendRef = useRef<() => Promise<void>>(async () => {});

  // Playback events drive the speaking -> idle transition.
  useEffect(() => {
    const player = getVoicePlayer();
    return player.subscribe((event) => {
      if (event === 'play') {
        assistant.getState().setState('speaking');
        return;
      }
      if (event === 'ended' || event === 'error' || event === 'stop') {
        const state = assistant.getState();
        if (state.state === 'speaking') state.setState('idle');
        state.setSpeakingMessage(null);
        if (event === 'error') {
          state.notify({ tone: 'error', message: "Couldn't play that reply." });
        }
      }
    });
  }, [assistant]);

  const getRecorder = useCallback(() => {
    if (!recorderRef.current) {
      recorderRef.current = new VoiceRecorder({
        onLevel: (level) => assistant.getState().setInputLevel(level),
        onMaxDuration: () => {
          // Auto-send once the utterance limit is reached.
          void stopAndSendRef.current();
        },
      });
    }
    return recorderRef.current;
  }, [assistant]);

  const cancelInFlight = useCallback(() => {
    inFlight.current?.abort();
    inFlight.current = null;
    turnSeq.current += 1;
  }, []);

  const speak = useCallback(
    async (messageId: string, blobOverride?: Blob) => {
      const player = getVoicePlayer();
      const state = assistant.getState();
      let blob = blobOverride ?? cache.get(messageId);

      if (!blob) {
        const controller = new AbortController();
        inFlight.current = controller;
        const seq = turnSeq.current;
        try {
          blob = await api.fetchMessageAudio(messageId, controller.signal);
        } catch (error) {
          if (error instanceof ApiClientError && error.code === 'aborted') return;
          throw error;
        } finally {
          if (inFlight.current === controller) inFlight.current = null;
        }
        if (seq !== turnSeq.current) return;
        cache.set(messageId, blob);
      }

      try {
        // The player emits 'play' once audio starts, which moves the state to speaking.
        await player.play(blob);
        state.setSpeakingMessage(messageId);
      } catch {
        // Autoplay policies can reject playback; leave the transcript readable.
        state.setSpeakingMessage(null);
        state.setState('idle');
        state.notify({
          tone: 'info',
          message:
            'Playback was blocked by the browser. Tap the reply in the transcript to hear it.',
        });
      }
    },
    [api, assistant, cache]
  );

  const runTurn = useCallback(
    async (audio: Blob) => {
      const state = assistant.getState();
      const seq = ++turnSeq.current;
      const controller = new AbortController();
      inFlight.current = controller;
      state.setState('thinking');
      state.notify(null);

      try {
        const { transcript } = await api.transcribe(audio, controller.signal);
        if (seq !== turnSeq.current) return;
        conversations.getState().setPendingTurn({ transcript });

        const result = await api.respond(
          {
            transcript,
            ...(conversations.getState().activeId
              ? { conversationId: conversations.getState().activeId as string }
              : {}),
          },
          controller.signal
        );
        if (seq !== turnSeq.current) return;

        const convo = conversations.getState();
        convo.upsertConversation(result.conversation);
        convo.appendMessages(result.conversation.id, [result.userMessage, result.assistantMessage]);

        state.express(
          result.assistantMessage.emotion ?? 'neutral',
          result.assistantMessage.gesture ?? 'none'
        );
        inFlight.current = null;
        await speak(result.assistantMessage.id);
      } catch (error) {
        if (seq !== turnSeq.current) return;
        if (error instanceof ApiClientError && error.code === 'aborted') return;
        conversations.getState().setPendingTurn(null);
        state.notify({ tone: 'error', message: describeError(error) });
        state.express('concerned', 'none');
        const isProviderTrouble =
          error instanceof ApiClientError &&
          (error.code === 'upstream_error' ||
            error.code === 'upstream_timeout' ||
            error.code === 'network');
        if (isProviderTrouble) {
          await getVoicePlayer()
            .playUrl(FALLBACK_AUDIO_URL)
            .catch(() => state.setState('idle'));
        } else {
          state.setState('idle');
        }
      } finally {
        if (inFlight.current === controller) inFlight.current = null;
      }
    },
    [api, assistant, conversations, speak]
  );

  const stopAndSend = useCallback(async () => {
    const recorder = recorderRef.current;
    const state = assistant.getState();
    if (!recorder?.isRecording) return;

    const result = await recorder.stop();
    const verdict = classifyRecording(result);
    if (verdict === 'too_short') {
      state.setState('idle');
      state.notify({ tone: 'info', message: 'Hold the button while you talk, then let go.' });
      return;
    }
    if (verdict === 'silent') {
      state.setState('idle');
      state.notify({
        tone: 'info',
        message: "Flare didn't hear anything. Check your microphone and try again.",
      });
      return;
    }
    await runTurn(result.blob);
  }, [assistant, runTurn]);

  useEffect(() => {
    stopAndSendRef.current = stopAndSend;
  }, [stopAndSend]);

  const startListening = useCallback(async () => {
    const state = assistant.getState();
    if (state.state === 'thinking') return;
    if (state.state === 'speaking') {
      cancelInFlight();
      getVoicePlayer().stop();
    }
    state.notify(null);
    state.relax();
    try {
      await getRecorder().start();
      state.setState('listening');
    } catch (error) {
      const denied = error instanceof DOMException && error.name === 'NotAllowedError';
      state.setState('idle');
      state.notify({
        tone: 'error',
        message: denied
          ? 'Microphone access is blocked. Allow it in your browser settings to talk to Flare.'
          : "Couldn't start the microphone.",
      });
    }
  }, [assistant, cancelInFlight, getRecorder]);

  const interrupt = useCallback(() => {
    cancelInFlight();
    recorderRef.current?.cancel();
    getVoicePlayer().stop();
    const state = assistant.getState();
    conversations.getState().setPendingTurn(null);
    state.setSpeakingMessage(null);
    state.setState('idle');
  }, [assistant, cancelInFlight, conversations]);

  const replay = useCallback(
    async (messageId: string) => {
      const state = assistant.getState();
      if (state.state === 'listening' || state.state === 'thinking') return;
      cancelInFlight();
      getVoicePlayer().stop();
      const message = conversations.getState().messages.find((m) => m.id === messageId);
      if (message?.emotion) state.express(message.emotion, message.gesture ?? 'none');
      try {
        await speak(messageId);
      } catch (error) {
        state.setState('idle');
        state.notify({ tone: 'error', message: describeError(error) });
      }
    },
    [assistant, cancelInFlight, conversations, speak]
  );

  useEffect(
    () => () => {
      cancelInFlight();
      recorderRef.current?.cancel();
      getVoicePlayer().stop();
    },
    [cancelInFlight]
  );

  return { startListening, stopAndSend, interrupt, replay };
}
