'use client';

import { useEffect, useRef, useCallback } from 'react';

export interface VisemeWeights {
  viseme_sil: number;
  viseme_PP: number;
  viseme_FF: number;
  viseme_TH: number;
  viseme_DD: number;
  viseme_kk: number;
  viseme_CH: number;
  viseme_SS: number;
  viseme_nn: number;
  viseme_RR: number;
  viseme_aa: number;
  viseme_E: number;
  viseme_I: number;
  viseme_O: number;
  viseme_U: number;
  jawOpen: number;
  mouthSmileLeft: number;
  mouthSmileRight: number;
}

const DEFAULT_VISEMES: VisemeWeights = {
  viseme_sil: 1,
  viseme_PP: 0,
  viseme_FF: 0,
  viseme_TH: 0,
  viseme_DD: 0,
  viseme_kk: 0,
  viseme_CH: 0,
  viseme_SS: 0,
  viseme_nn: 0,
  viseme_RR: 0,
  viseme_aa: 0,
  viseme_E: 0,
  viseme_I: 0,
  viseme_O: 0,
  viseme_U: 0,
  jawOpen: 0,
  mouthSmileLeft: 0.1,
  mouthSmileRight: 0.1,
};

export function useVisage(audioElement: HTMLAudioElement | null, isSpeaking: boolean) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const frequencyDataRef = useRef<Uint8Array | null>(null);
  const currentVisemesRef = useRef<VisemeWeights>({ ...DEFAULT_VISEMES });

  // Initialize Web Audio API AnalyserNode when audio element is provided
  useEffect(() => {
    if (!audioElement) return;

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;

      if (!analyserRef.current) {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.75;
        analyser.minDecibels = -85;
        analyser.maxDecibels = -10;
        analyserRef.current = analyser;
        frequencyDataRef.current = new Uint8Array(analyser.frequencyBinCount);
      }

      // Connect HTMLAudioElement to AnalyserNode once
      if (!sourceRef.current) {
        try {
          const source = ctx.createMediaElementSource(audioElement);
          source.connect(analyserRef.current);
          analyserRef.current.connect(ctx.destination);
          sourceRef.current = source;
        } catch {
          // In case element is already connected to another graph
        }
      }

      // Resume context if suspended by browser autoplay policy
      if (ctx.state === 'suspended') {
        const resumeCtx = () => {
          ctx.resume();
          window.removeEventListener('click', resumeCtx);
          window.removeEventListener('keydown', resumeCtx);
        };
        window.addEventListener('click', resumeCtx, { once: true });
        window.addEventListener('keydown', resumeCtx, { once: true });
      }
    } catch (err) {
      console.warn('Web Audio API initialization warning:', err);
    }

    return () => {
      // Keep nodes alive for subsequent audio plays
    };
  }, [audioElement]);

  // Compute real-time ARKit visemes from FFT spectrum
  const getVisemes = useCallback((): VisemeWeights => {
    if (!isSpeaking || !analyserRef.current || !frequencyDataRef.current) {
      // Decay back to neutral resting visemes
      return {
        ...DEFAULT_VISEMES,
        mouthSmileLeft: 0.12,
        mouthSmileRight: 0.12,
      };
    }

    const analyser = analyserRef.current;
    const data = frequencyDataRef.current;
    analyser.getByteFrequencyData(data as Uint8Array<ArrayBuffer>);

    // FFT Bin Resolution: SampleRate (e.g. 48000) / fftSize (512) = ~93.75 Hz per bin
    // Bin 0-4:   0 - 400 Hz    (Pitch, Vowel base, Jaw opening)
    // Bin 4-12:  400 - 1200 Hz (Formant 1: 'aa', 'O', 'E')
    // Bin 12-28: 1200 - 2800 Hz (Formant 2: 'I', 'E', 'U')
    // Bin 28-64: 2800 - 6000 Hz (High frequencies: Sibilance 'SS', 'CH', 'FF', 'TH')

    const getAverageEnergy = (startBin: number, endBin: number): number => {
      let sum = 0;
      const count = Math.max(1, endBin - startBin);
      for (let i = startBin; i < endBin && i < data.length; i++) {
        sum += data[i];
      }
      return sum / count / 255; // Normalized 0.0 - 1.0
    };

    const overallVolume = getAverageEnergy(1, 40);
    const lowFreq = getAverageEnergy(1, 5);      // 100 - 500 Hz
    const midLowFreq = getAverageEnergy(5, 12);  // 500 - 1200 Hz
    const midHighFreq = getAverageEnergy(12, 28);// 1200 - 2800 Hz
    const highFreq = getAverageEnergy(28, 60);   // 2800 - 6000 Hz

    if (overallVolume < 0.05) {
      return {
        ...DEFAULT_VISEMES,
        mouthSmileLeft: 0.12,
        mouthSmileRight: 0.12,
      };
    }

    // Map frequency band energies to ARKit blend shapes
    const jawOpen = Math.min(1, Math.max(0, (overallVolume * 1.5 + lowFreq * 0.8) * 0.9));
    const viseme_aa = Math.min(1, Math.max(0, (midLowFreq * 1.6 + lowFreq * 0.5) * 0.85));
    const viseme_O = Math.min(1, Math.max(0, (lowFreq * 1.4 + midLowFreq * 0.4) * 0.75));
    const viseme_E = Math.min(1, Math.max(0, (midLowFreq * 0.8 + midHighFreq * 1.2) * 0.7));
    const viseme_I = Math.min(1, Math.max(0, (midHighFreq * 1.5 + highFreq * 0.5) * 0.7));
    const viseme_U = Math.min(1, Math.max(0, (lowFreq * 0.9 + midHighFreq * 0.6) * 0.6));
    const viseme_SS = Math.min(1, Math.max(0, (highFreq * 1.8) * 0.65));
    const viseme_FF = Math.min(1, Math.max(0, (highFreq * 1.2 + midHighFreq * 0.4) * 0.5));
    const viseme_TH = Math.min(1, Math.max(0, (midHighFreq * 0.9 + highFreq * 0.8) * 0.5));
    const viseme_PP = Math.min(1, Math.max(0, overallVolume > 0.4 && lowFreq > 0.5 ? 0.3 : 0));

    const weights: VisemeWeights = {
      viseme_sil: overallVolume < 0.1 ? 0.8 : 0,
      viseme_PP,
      viseme_FF,
      viseme_TH,
      viseme_DD: (viseme_E + viseme_I) * 0.4,
      viseme_kk: (viseme_aa + viseme_O) * 0.3,
      viseme_CH: viseme_SS * 0.7,
      viseme_SS,
      viseme_nn: (viseme_E + viseme_aa) * 0.3,
      viseme_RR: viseme_O * 0.4,
      viseme_aa,
      viseme_E,
      viseme_I,
      viseme_O,
      viseme_U,
      jawOpen,
      mouthSmileLeft: 0.15 + (viseme_I + viseme_E) * 0.2,
      mouthSmileRight: 0.15 + (viseme_I + viseme_E) * 0.2,
    };

    currentVisemesRef.current = weights;
    return weights;
  }, [isSpeaking]);

  return { getVisemes, audioContextRef };
}
