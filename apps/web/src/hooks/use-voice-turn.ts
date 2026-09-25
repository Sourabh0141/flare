'use client';

import type { Message, TurnEvent } from '@flare/contracts';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ApiClientError, describeError } from '@/lib/api/client';
import { AudioCache } from '@/lib/audio/audio-cache';
import { playCue, setCuesEnabled } from '@/lib/audio/cues';
import { getVoicePlayer } from '@/lib/audio/player';
import { classifyRecording, VoiceRecorder } from '@/lib/audio/recorder';
import { startSpeechListener } from '@/lib/audio/silero-vad';
import type { SpeechListener } from '@/lib/audio/vad';
import { FALLBACK_AUDIO_URL } from '@/lib/config';
import { readPrefs } from '@/lib/prefs';
import { useAssistantStore } from '@/stores/assistant-store';
import { useConversationStore } from '@/stores/conversation-store';
import { useApiClient } from './use-api-client';

function base64ToBlob(data: string, mimeType: string): Blob {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

/**
 * The voice turn: record, transcribe, then stream the reply. Sentences are spoken as their
 * audio arrives, while the model is still writing the rest. Each stage updates the
 * assistant state so the character and controls follow along, and everything in flight
 * can be interrupted by the user at any moment.
 *
 * Two ways to start a turn share the same pipeline: hold-to-talk and hands-free. Hands-free
 * is half-duplex unless barge-in is enabled, in which case a guarded detector keeps
 * listening while Flare speaks and deliberate speech interrupts it.
 */
export function useVoiceTurn() {
  const api = useApiClient();
  const assistant = useAssistantStore;
  const conversations = useConversationStore;
  const cache = useMemo(() => new AudioCache(), []);
  const recorderRef = useRef<VoiceRecorder | null>(null);
  const listenerRef = useRef<SpeechListener | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  const turnSeq = useRef(0);
  const stopAndSendRef = useRef<() => Promise<void>>(async () => {});
  const runTurnRef = useRef<(audio: Blob) => Promise<void>>(async () => {});
  const interruptRef = useRef<() => void>(() => {});

  useEffect(() => {
    setCuesEnabled(readPrefs().soundCues);
  }, []);

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

  // Hands-free follows the assistant state: paused (or guarded for barge-in) while Flare is
  // busy, listening again once it is idle.
  useEffect(
    () =>
      assistant.subscribe((s, prev) => {
        const listener = listenerRef.current;
        if (!listener || s.handsFree === 'off') return;
        if (s.state === prev.state && s.handsFree === prev.handsFree) return;

        if (s.handsFree === 'muted') {
          listener.setMode('paused');
          return;
        }
        if (s.state === 'thinking') {
          listener.setMode('paused');
        } else if (s.state === 'speaking') {
          listener.setMode(readPrefs().bargeIn ? 'guarded' : 'paused');
        } else if (s.state === 'idle' || s.state === 'listening') {
          const wasBusy = prev.state === 'thinking' || prev.state === 'speaking';
          const resume = () => {
            const current = assistant.getState();
            if (listenerRef.current !== listener || current.handsFree !== 'listening') return;
            listener.setMode('listening');
            if (current.state === 'idle') {
              current.setState('listening');
              playCue('listen');
            }
          };
          // A short gap after speech so the tail of the reply does not count as input.
          if (wasBusy) setTimeout(resume, 350);
          else resume();
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

  /** Plays a whole stored reply (replay), from cache or the audio endpoint. */
  const speakMessage = useCallback(
    async (message: Message) => {
      const player = getVoicePlayer();
      const state = assistant.getState();
      let blob = cache.get(message.id);

      if (!blob) {
        const controller = new AbortController();
        inFlight.current = controller;
        const seq = turnSeq.current;
        try {
          blob = await api.fetchMessageAudio(message.id, controller.signal);
        } catch (error) {
          if (error instanceof ApiClientError && error.code === 'aborted') return;
          throw error;
        } finally {
          if (inFlight.current === controller) inFlight.current = null;
        }
        if (seq !== turnSeq.current) return;
        cache.set(message.id, blob);
      }

      try {
        await player.play(blob, message.content);
        state.setSpeakingMessage(message.id);
      } catch {
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
      const player = getVoicePlayer();
      const seq = ++turnSeq.current;
      const controller = new AbortController();
      inFlight.current = controller;
      state.setState('thinking');
      state.notify(null);
      playCue('sent');

      try {
        const { transcript, language } = await api.transcribe(audio, controller.signal);
        if (seq !== turnSeq.current) return;
        conversations.getState().setPendingTurn({ transcript, reply: '' });

        const activeId = conversations.getState().activeId;
        const sentences = new Map<number, string>();
        const audioParts: Blob[] = [];
        let userMessage: Message | null = null;
        let assistantMessage: Message | null = null;

        player.beginQueue();

        await api.respondStream(
          {
            transcript,
            ...(activeId ? { conversationId: activeId } : {}),
            ...(language ? { language } : {}),
          },
          (event: TurnEvent) => {
            if (seq !== turnSeq.current) return;
            const convo = conversations.getState();
            switch (event.type) {
              case 'meta':
                userMessage = event.userMessage;
                convo.upsertConversation(event.conversation);
                state.setTurnsRemaining(event.turnsRemainingToday);
                break;
              case 'expression':
                state.express(
                  event.expression.emotion,
                  event.expression.gesture,
                  event.expression.intensity
                );
                break;
              case 'delta':
                convo.appendPendingReply(event.text);
                break;
              case 'sentence':
                sentences.set(event.index, event.text);
                break;
              case 'audio': {
                const blob = base64ToBlob(event.data, event.mimeType);
                audioParts[event.index] = blob;
                const text = sentences.get(event.index);
                player.enqueue({ blob, ...(text ? { text } : {}) });
                break;
              }
              case 'done':
                assistantMessage = event.assistantMessage;
                convo.upsertConversation(event.conversation);
                break;
              case 'error':
                throw new ApiClientError(event.code as ApiClientError['code'], event.message);
            }
          },
          controller.signal
        );
        if (seq !== turnSeq.current) return;

        if (userMessage && assistantMessage) {
          const done: Message = assistantMessage;
          conversations.getState().appendMessages(done.conversationId, [userMessage, done]);
          const parts = audioParts.filter(Boolean);
          if (parts.length > 0) {
            cache.set(done.id, new Blob(parts, { type: parts[0]?.type ?? 'audio/mpeg' }));
          }
          state.setSpeakingMessage(done.id);
          if (state.turnsRemainingToday !== null && state.turnsRemainingToday <= 10) {
            state.notify({
              tone: 'info',
              message: `${state.turnsRemainingToday} turns left today.`,
            });
          }
        }
        inFlight.current = null;
        player.close();
        // Nothing to play (every sentence failed to synthesise): return to idle.
        if (!player.isActive && assistant.getState().state === 'thinking') {
          state.setState('idle');
        }
      } catch (error) {
        if (seq !== turnSeq.current) return;
        if (error instanceof ApiClientError && error.code === 'aborted') return;
        player.stop();
        conversations.getState().setPendingTurn(null);
        state.notify({ tone: 'error', message: describeError(error) });
        state.express('concerned', 'none', 0.5);
        playCue('error');
        const isProviderTrouble =
          error instanceof ApiClientError &&
          (error.code === 'upstream_error' ||
            error.code === 'upstream_timeout' ||
            error.code === 'network');
        if (isProviderTrouble) {
          await player.playUrl(FALLBACK_AUDIO_URL).catch(() => state.setState('idle'));
        } else {
          state.setState('idle');
        }
      } finally {
        if (inFlight.current === controller) inFlight.current = null;
      }
    },
    [api, assistant, cache, conversations]
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
      playCue('listen');
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
    state.setState(state.handsFree === 'listening' ? 'listening' : 'idle');
  }, [assistant, cancelInFlight, conversations]);

  useEffect(() => {
    interruptRef.current = interrupt;
  }, [interrupt]);

  const replay = useCallback(
    async (messageId: string) => {
      const state = assistant.getState();
      if (state.state === 'thinking') return;
      cancelInFlight();
      getVoicePlayer().stop();
      const message = conversations.getState().messages.find((m) => m.id === messageId);
      if (!message) return;
      if (message.emotion) {
        state.express(message.emotion, message.gesture ?? 'none', message.intensity ?? 0.6);
      }
      try {
        await speakMessage(message);
      } catch (error) {
        state.setState('idle');
        state.notify({ tone: 'error', message: describeError(error) });
      }
    },
    [assistant, cancelInFlight, conversations, speakMessage]
  );

  // ---------------------------------------------------------------------------
  // Hands-free
  // ---------------------------------------------------------------------------

  const stopHandsFree = useCallback(() => {
    listenerRef.current?.stop();
    listenerRef.current = null;
    const state = assistant.getState();
    state.setHandsFree('off', null);
    state.setInputLevel(0);
    if (state.state === 'listening') state.setState('idle');
  }, [assistant]);

  const startHandsFree = useCallback(async () => {
    const state = assistant.getState();
    if (listenerRef.current) return;
    if (state.state === 'listening') recorderRef.current?.cancel();

    let listener: SpeechListener;
    try {
      listener = await startSpeechListener(
        {
          onLevel: (level) => assistant.getState().setInputLevel(level),
          onReady: () => {
            const s = assistant.getState();
            if (s.handsFree === 'listening' && s.state === 'idle') {
              s.setState('listening');
              playCue('listen');
            }
          },
          onSpeechStart: () => assistant.getState().notify(null),
          onUtterance: ({ blob, durationMs, peakLevel, bargeIn }) => {
            const s = assistant.getState();
            if (s.handsFree !== 'listening') return;
            if (classifyRecording({ blob, durationMs, peakLevel }) !== 'ok') return;
            if (bargeIn) interruptRef.current();
            listenerRef.current?.setMode('paused');
            s.relax();
            void runTurnRef.current(blob);
          },
        },
        readPrefs().neuralVad
      );
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
    state.setHandsFree('listening', listener.kind);
    if (state.state === 'idle') {
      state.setState('listening');
      playCue('listen');
    }
  }, [assistant]);

  const toggleHandsFreeMute = useCallback(() => {
    const state = assistant.getState();
    if (!listenerRef.current) return;
    if (state.handsFree === 'listening') {
      state.setHandsFree('muted');
      if (state.state === 'listening') state.setState('idle');
    } else if (state.handsFree === 'muted') {
      state.setHandsFree('listening');
      if (state.state === 'idle') state.setState('listening');
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
