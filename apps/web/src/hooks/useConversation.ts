'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useConversations } from '@/context/ConversationContext';
import { sendVoiceTurn } from '@/lib/api';
import { CharacterState } from '@/components/Avatar';

export interface UseConversationReturn {
  state: CharacterState;
  errorMessage: string | null;
  lastTranscript: string | null;
  lastResponse: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  interrupt: () => void;
  clearError: () => void;
}

export function useConversation(
  audioRef: React.RefObject<HTMLAudioElement | null>
): UseConversationReturn {
  const { getToken } = useAuth();
  const { activeConversationId, updateAfterVoiceTurn } = useConversations();

  const [state, setState] = useState<CharacterState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Clean up object URLs and active streams on unmount
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Listen to audio element ended/pause events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      setState('idle');
    };

    const handleError = () => {
      setState('idle');
      setErrorMessage('Audio playback error');
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [audioRef]);

  // Helper to play fallback error audio (R32 / AE3)
  const playFallbackAudio = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) {
      setState('idle');
      return;
    }

    try {
      audio.src = '/audio/fallback-error.wav';
      audio.load();
      await audio.play();
    } catch {
      setState('idle');
    }
  }, [audioRef]);

  // Start Push-To-Talk Voice Recording (R21, R22)
  const startRecording = useCallback(async () => {
    if (state === 'processing') return; // PTT blocked during processing (R24 / AE1)

    // Stop any existing playback if speaking
    if (state === 'speaking' && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    setErrorMessage(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Select best supported MIME type
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/wav',
      ];
      let selectedMime = '';
      for (const mime of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          selectedMime = mime;
          break;
        }
      }

      const recorder = selectedMime
        ? new MediaRecorder(stream, { mimeType: selectedMime })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recordingStartTimeRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start(100); // Collect in 100ms slices
      setState('listening');
    } catch (err) {
      console.error('Microphone access failed:', err);
      setErrorMessage(
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Microphone permission denied. Please allow mic access.'
          : 'Could not access microphone.'
      );
      setState('idle');
    }
  }, [state, audioRef]);

  // Stop Recording and Dispatch Conversation Turn (R23, R24, R27-R32)
  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'recording') {
      return;
    }

    const duration = Date.now() - recordingStartTimeRef.current;

    recorder.onstop = async () => {
      // Stop all microphone tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      // Ignore micro-taps (<250ms)
      if (duration < 250 || audioChunksRef.current.length === 0) {
        setState('idle');
        return;
      }

      const mimeType = recorder.mimeType || 'audio/webm';
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

      setState('processing');

      try {
        const token = await getToken();
        if (!token) {
          throw new Error('Authentication token missing. Please sign in again.');
        }

        abortControllerRef.current = new AbortController();

        const result = await sendVoiceTurn(
          token,
          audioBlob,
          activeConversationId
        );

        setLastTranscript(result.userTranscript);
        setLastResponse(result.assistantResponse);

        // Update active conversation and sync sidebar (R18, R19)
        if (result.conversationId) {
          updateAfterVoiceTurn(
            result.conversationId,
            result.userTranscript,
            result.assistantResponse
          );
        }

        // Play the AI synthesized audio response (R31, R38)
        if (audioRef.current && result.audioBlob.size > 0) {
          if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
          }
          const blobUrl = URL.createObjectURL(result.audioBlob);
          objectUrlRef.current = blobUrl;

          audioRef.current.src = blobUrl;
          audioRef.current.load();

          setState('speaking');
          await audioRef.current.play();
        } else {
          setState('idle');
        }
      } catch (err: unknown) {
        console.error('Conversation turn error:', err);
        const msg = err instanceof Error ? err.message : 'Error processing speech turn.';
        setErrorMessage(msg);

        // Play fallback error audio (R32 / AE3)
        await playFallbackAudio();
      }
    };

    recorder.stop();
  }, [
    activeConversationId,
    getToken,
    updateAfterVoiceTurn,
    audioRef,
    playFallbackAudio,
  ]);

  // Immediate Interruption (R25, AE2)
  const interrupt = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setState('idle');
  }, [audioRef]);

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  return {
    state,
    errorMessage,
    lastTranscript,
    lastResponse,
    startRecording,
    stopRecording,
    interrupt,
    clearError,
  };
}
