'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ApiClientError, describeError } from '@/lib/api/client';
import { AudioCache } from '@/lib/audio/audio-cache';
import { getVoicePlayer } from '@/lib/audio/player';
import { classifyRecording, VoiceRecorder } from '@/lib/audio/recorder';
import { HandsFreeListener } from '@/lib/audio/vad';
import { FALLBACK_AUDIO_URL } from '@/lib/config';
import { useAssistantStore } from '@/stores/assistant-store';
import { useConversationStore } from '@/stores/conversation-store';
import { useApiClient } from './use-api-client';

/**
 * The voice turn: record, transcribe, respond, speak. Each stage updates the assistant
 * state so the character and controls follow along, and everything in flight can be
 * interrupted by the user at any moment.
 *
 * Two ways to start a turn share the same pipeline: hold-to-talk (explicit start and
 * stop) and hands-free (a voice-activity gate decides). Hands-free is half-duplex: the
 * microphone is paused while Flare thinks or speaks.
 */
export function useVoiceTurn() {
  const api = useApiClient();
  const assistant = useAssistantStore;
  const conversations = useConversationStore;
  const cache = useMemo(() => new AudioCache(), []);
  const recorderRef = useRef<VoiceRecorder | null>(null);
  const listenerRef = useRef<HandsFreeListener | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  const turnSeq = useRef(0);
  const stopAndSendRef = useRef<() => Promise<void>>(async () => {});
  const runTurnRef = useRef<(audio: Blob) => Promise<void>>(async () => {});

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

  // Hands-free is half-duplex: pause the gate whenever Flare is busy, resume when idle.
  useEffect(
    () =>
      assistant.subscribe((s, prev) => {
        const listener = listenerRef.current;
        if (!listener || s.handsFree === 'off') return;
        const busy = s.state === 'thinking' || s.state === 'speaking';
        const wasBusy = prev.state === 'thinking' || prev.state === 'speaking';
        if (busy && !wasBusy) listener.pause();
        if (!busy && wasBusy && s.handsFree === 'listening') {
          // A short gap so the tail of the reply does not count as speech.
          setTimeout(() => {
            const current = assistant.getState();
            if (listenerRef.current === listener && current.handsFree === 'listening') {
              listener.resume();
              if (current.state === 'idle') current.setState('listening');
            }
          }, 350);
        }
      }),
    [assistant]
  );

  const getRecorder = useCallback(() => {
    if (!recorderRef.current) {
      recorderRef.current = new VoiceRecorder({
        onLevel: (level) => assistant.getState().setInputLevel(level),
        onMaxDuration: () => {
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

        const activeId = conversations.getState().activeId;
        const result = await api.respond(
          { transcript, ...(activeId ? { conversationId: activeId } : {}) },
          controller.signal
        );
        if (seq !== turnSeq.current) return;

        const convo = conversations.getState();
        convo.upsertConversation(result.conversation);
        convo.appendMessages(result.conversation.id, [result.userMessage, result.assistantMessage]);

        state.setTurnsRemaining(result.turnsRemainingToday);
        if (result.turnsRemainingToday > 0 && result.turnsRemainingToday <= 10) {
          state.notify({
            tone: 'info',
            message: `${result.turnsRemainingToday} turns left today.`,
          });
        }
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

  useEffect(() => {
    runTurnRef.current = runTurn;
  }, [runTurn]);

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
    if (state.handsFree !== 'off') return; // hands-free owns the microphone
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
    if (state.handsFree === 'listening') {
      listenerRef.current?.resume();
      state.setState('listening');
    } else {
      state.setState('idle');
    }
  }, [assistant, cancelInFlight, conversations]);

  const replay = useCallback(
    async (messageId: string) => {
      const state = assistant.getState();
      if (state.state === 'thinking') return;
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

  // ---------------------------------------------------------------------------
  // Hands-free
  // ---------------------------------------------------------------------------

  const stopHandsFree = useCallback(() => {
    listenerRef.current?.stop();
    listenerRef.current = null;
    const state = assistant.getState();
    state.setHandsFree('off');
    state.setInputLevel(0);
    if (state.state === 'listening') state.setState('idle');
  }, [assistant]);

  const startHandsFree = useCallback(async () => {
    const state = assistant.getState();
    if (listenerRef.current) return;
    if (state.state === 'listening') recorderRef.current?.cancel();

    const listener = new HandsFreeListener({
      onLevel: (level) => assistant.getState().setInputLevel(level),
      onReady: () => {
        const s = assistant.getState();
        if (s.handsFree === 'listening' && s.state === 'idle') s.setState('listening');
      },
      onSpeechStart: () => assistant.getState().notify(null),
      onUtterance: ({ blob, durationMs, peakLevel }) => {
        const s = assistant.getState();
        if (s.handsFree !== 'listening') return;
        const verdict = classifyRecording({ blob, durationMs, peakLevel });
        if (verdict !== 'ok') return;
        listener.pause();
        s.relax();
        void runTurnRef.current(blob);
      },
    });

    try {
      await listener.start();
    } catch (error) {
      const denied = error instanceof DOMException && error.name === 'NotAllowedError';
      state.notify({
        tone: 'error',
        message: denied
          ? 'Microphone access is blocked. Allow it in your browser settings for hands-free.'
          : "Couldn't start the microphone for hands-free.",
      });
      return;
    }

    listenerRef.current = listener;
    state.notify(null);
    state.setHandsFree('listening');
    if (state.state === 'idle') state.setState('listening');
  }, [assistant]);

  const toggleHandsFreeMute = useCallback(() => {
    const state = assistant.getState();
    const listener = listenerRef.current;
    if (!listener) return;
    if (state.handsFree === 'listening') {
      listener.pause();
      state.setHandsFree('muted');
      if (state.state === 'listening') state.setState('idle');
    } else if (state.handsFree === 'muted') {
      state.setHandsFree('listening');
      if (state.state === 'idle') {
        listener.resume();
        state.setState('listening');
      }
    }
  }, [assistant]);

  useEffect(
    () => () => {
      cancelInFlight();
      recorderRef.current?.cancel();
      listenerRef.current?.stop();
      listenerRef.current = null;
      getVoicePlayer().stop();
    },
    [cancelInFlight]
  );

  return {
    startListening,
    stopAndSend,
    interrupt,
    replay,
    startHandsFree,
    stopHandsFree,
    toggleHandsFreeMute,
  };
}
