import { LIMITS } from '@flare/contracts';

/** Codecs in preference order; the first the browser supports is used. */
const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
];

/** Below this RMS peak the recording is treated as silence and never uploaded. */
export const SILENCE_RMS_THRESHOLD = 0.012;

export interface RecordingResult {
  blob: Blob;
  durationMs: number;
  /** Loudest short-window RMS observed during the recording, 0..1. */
  peakLevel: number;
}

export type RecorderStopReason = 'released' | 'max_duration' | 'cancelled';

export interface RecorderOptions {
  /** Called at animation-frame rate with the current input level (0..1) for the UI. */
  onLevel?: (level: number) => void;
  /** Called when the recording hits the maximum utterance length. */
  onMaxDuration?: () => void;
  maxDurationMs?: number;
}

export function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
}

/** Root-mean-square of a time-domain sample window scaled to 0..1. */
export function rmsOf(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const s = samples[i] ?? 0;
    sum += s * s;
  }
  return Math.sqrt(sum / samples.length);
}

/** Maps a raw RMS to a perceptual meter value so quiet speech still moves the ring. */
export function levelFromRms(rms: number): number {
  return Math.min(1, Math.max(0, Math.log10(1 + rms * 40) / Math.log10(41)));
}

/**
 * Push-to-talk microphone capture. Owns the MediaStream, MediaRecorder and a small analyser
 * that meters input level; silence is detected on the client so empty recordings never
 * cost a network round trip.
 */
export class VoiceRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private meterFrame = 0;
  private maxTimer: ReturnType<typeof setTimeout> | null = null;
  private startedAt = 0;
  private peakLevel = 0;
  private stopReason: RecorderStopReason = 'released';
  private readonly maxDurationMs: number;

  constructor(private readonly options: RecorderOptions = {}) {
    this.maxDurationMs = options.maxDurationMs ?? LIMITS.utteranceMaxMs;
  }

  get isRecording(): boolean {
    return this.recorder?.state === 'recording';
  }

  async start(): Promise<void> {
    if (this.isRecording) return;

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });

    const mimeType = pickMimeType();
    this.recorder = mimeType
      ? new MediaRecorder(this.stream, { mimeType, audioBitsPerSecond: 32_000 })
      : new MediaRecorder(this.stream);
    this.chunks = [];
    this.peakLevel = 0;
    this.stopReason = 'released';
    this.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    };

    this.startMeter();
    this.startedAt = performance.now();
    this.recorder.start(250);

    this.maxTimer = setTimeout(() => {
      this.stopReason = 'max_duration';
      this.options.onMaxDuration?.();
    }, this.maxDurationMs);
  }

  /** Stops capture and resolves with the encoded recording. */
  async stop(): Promise<RecordingResult> {
    const recorder = this.recorder;
    if (!recorder || recorder.state === 'inactive') {
      this.teardown();
      return { blob: new Blob([], { type: 'audio/webm' }), durationMs: 0, peakLevel: 0 };
    }

    const durationMs = performance.now() - this.startedAt;
    const mimeType = recorder.mimeType || 'audio/webm';

    const stopped = new Promise<void>((resolve) => {
      recorder.addEventListener('stop', () => resolve(), { once: true });
    });
    recorder.stop();
    await stopped;

    const blob = new Blob(this.chunks, { type: mimeType.split(';')[0] ?? 'audio/webm' });
    const peakLevel = this.peakLevel;
    this.teardown();
    return { blob, durationMs, peakLevel };
  }

  /** Discards the recording without producing a result. */
  cancel(): void {
    this.stopReason = 'cancelled';
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.ondataavailable = null;
      this.recorder.stop();
    }
    this.teardown();
  }

  get reason(): RecorderStopReason {
    return this.stopReason;
  }

  private startMeter(): void {
    if (!this.stream || typeof AudioContext === 'undefined') return;
    try {
      this.context = new AudioContext();
      const source = this.context.createMediaStreamSource(this.stream);
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 1024;
      source.connect(this.analyser);
      const buffer = new Float32Array(this.analyser.fftSize);

      const tick = () => {
        if (!this.analyser) return;
        this.analyser.getFloatTimeDomainData(buffer);
        const rms = rmsOf(buffer);
        this.peakLevel = Math.max(this.peakLevel, rms);
        this.options.onLevel?.(levelFromRms(rms));
        this.meterFrame = requestAnimationFrame(tick);
      };
      this.meterFrame = requestAnimationFrame(tick);
    } catch {
      // Metering is a nicety; recording still works without it.
    }
  }

  private teardown(): void {
    if (this.maxTimer) clearTimeout(this.maxTimer);
    this.maxTimer = null;
    cancelAnimationFrame(this.meterFrame);
    this.analyser?.disconnect();
    this.analyser = null;
    void this.context?.close().catch(() => {});
    this.context = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.recorder = null;
    this.chunks = [];
    this.options.onLevel?.(0);
  }
}

/** Decides whether a finished recording is worth sending. */
export function classifyRecording(result: RecordingResult): 'ok' | 'too_short' | 'silent' {
  if (result.durationMs < LIMITS.utteranceMinMs || result.blob.size === 0) return 'too_short';
  if (result.peakLevel < SILENCE_RMS_THRESHOLD) return 'silent';
  return 'ok';
}
