import { LIMITS } from '@flare/contracts';
import { pickMimeType, rmsOf, levelFromRms } from './recorder';

/**
 * Voice activity gate for hands-free mode. Pure and time-based so it can be unit tested
 * without audio hardware: feed it RMS levels with timestamps and it emits speech events.
 *
 * It learns the room's noise floor while idle and opens when the level stays above an
 * adaptive threshold for a short attack window; it closes after a trailing silence. In
 * guarded mode (used for barge-in while Flare speaks) the threshold and attack window are
 * raised so only deliberate speech gets through.
 */
export interface VadConfig {
  /** Level must exceed the threshold for this long before speech starts. */
  attackMs: number;
  /** Silence must last this long before speech ends. */
  releaseMs: number;
  /** Utterances shorter than this are discarded as noise. */
  minSpeechMs: number;
  /** How long to sample the room before listening. */
  calibrationMs: number;
  /** Threshold = max(minThreshold, noiseFloor * gain + margin). */
  gain: number;
  margin: number;
  minThreshold: number;
  /** Hard stop for one utterance. */
  maxUtteranceMs: number;
}

export const DEFAULT_VAD_CONFIG: VadConfig = {
  attackMs: 90,
  releaseMs: 750,
  minSpeechMs: 350,
  calibrationMs: 600,
  gain: 2.2,
  margin: 0.006,
  minThreshold: 0.014,
  maxUtteranceMs: LIMITS.utteranceMaxMs,
};

/** Multipliers applied in guarded mode. */
const GUARD = { threshold: 2.6, attackMs: 260, minSpeechMs: 600 };

export type VadPhase = 'calibrating' | 'idle' | 'speaking';

export type VadEvent =
  | { type: 'ready' }
  | { type: 'speech_start'; at: number }
  | { type: 'speech_end'; at: number; durationMs: number; peakLevel: number }
  | { type: 'speech_discard'; durationMs: number };

export class VadGate {
  phase: VadPhase = 'calibrating';
  noiseFloor = 0;
  guarded = false;
  private startedAt: number | null = null;
  private aboveSince: number | null = null;
  private belowSince: number | null = null;
  private speechStartedAt = 0;
  private peak = 0;
  private calibrationSum = 0;
  private calibrationCount = 0;

  constructor(private readonly config: VadConfig = DEFAULT_VAD_CONFIG) {}

  get threshold(): number {
    const base = Math.max(
      this.config.minThreshold,
      this.noiseFloor * this.config.gain + this.config.margin
    );
    return this.guarded ? base * GUARD.threshold : base;
  }

  private get attackMs(): number {
    return this.guarded ? GUARD.attackMs : this.config.attackMs;
  }

  private get minSpeechMs(): number {
    return this.guarded ? GUARD.minSpeechMs : this.config.minSpeechMs;
  }

  /** Forget any in-progress speech and start listening again (after playback, for example). */
  reset(): void {
    this.phase = this.noiseFloor > 0 ? 'idle' : 'calibrating';
    this.aboveSince = null;
    this.belowSince = null;
    this.peak = 0;
  }

  update(rms: number, now: number): VadEvent | null {
    if (this.startedAt === null) this.startedAt = now;

    if (this.phase === 'calibrating') {
      this.calibrationSum += rms;
      this.calibrationCount += 1;
      if (now - this.startedAt >= this.config.calibrationMs) {
        this.noiseFloor =
          this.calibrationCount > 0 ? this.calibrationSum / this.calibrationCount : 0;
        this.phase = 'idle';
        return { type: 'ready' };
      }
      return null;
    }

    const threshold = this.threshold;

    if (this.phase === 'idle') {
      if (rms > threshold) {
        this.aboveSince ??= now;
        if (now - this.aboveSince >= this.attackMs) {
          this.phase = 'speaking';
          this.speechStartedAt = this.aboveSince;
          this.belowSince = null;
          this.peak = rms;
          this.aboveSince = null;
          return { type: 'speech_start', at: this.speechStartedAt };
        }
      } else {
        this.aboveSince = null;
        // Track the room slowly while quiet so the threshold follows the environment.
        if (!this.guarded) this.noiseFloor += (rms - this.noiseFloor) * 0.02;
      }
      return null;
    }

    // speaking
    this.peak = Math.max(this.peak, rms);
    const durationMs = now - this.speechStartedAt;
    if (rms < threshold * 0.6) {
      this.belowSince ??= now;
    } else {
      this.belowSince = null;
    }

    const silentFor = this.belowSince === null ? 0 : now - this.belowSince;
    const endedBySilence = silentFor >= this.config.releaseMs;
    const endedByLength = durationMs >= this.config.maxUtteranceMs;
    if (!endedBySilence && !endedByLength) return null;

    this.phase = 'idle';
    this.belowSince = null;
    const spokenMs = endedBySilence ? durationMs - silentFor : durationMs;
    if (spokenMs < this.minSpeechMs) {
      return { type: 'speech_discard', durationMs: spokenMs };
    }
    return { type: 'speech_end', at: now, durationMs: spokenMs, peakLevel: this.peak };
  }
}

// -----------------------------------------------------------------------------
// Listener interface shared by the energy gate and the neural detector
// -----------------------------------------------------------------------------

export interface HandsFreeUtterance {
  blob: Blob;
  durationMs: number;
  peakLevel: number;
  /** True when the utterance began while Flare was speaking (barge-in). */
  bargeIn: boolean;
}

/**
 * listening: normal detection. guarded: Flare is speaking; only deliberate speech counts,
 * and it interrupts. paused: nothing is detected.
 */
export type ListenerMode = 'listening' | 'guarded' | 'paused';

export interface HandsFreeListenerOptions {
  onUtterance: (utterance: HandsFreeUtterance) => void;
  onLevel?: (level: number) => void;
  onSpeechStart?: (bargeIn: boolean) => void;
  onReady?: () => void;
  config?: VadConfig;
}

export interface SpeechListener {
  readonly kind: 'energy' | 'silero';
  readonly isActive: boolean;
  readonly mode: ListenerMode;
  start(): Promise<void>;
  setMode(mode: ListenerMode): void;
  stop(): void;
}

// -----------------------------------------------------------------------------
// Energy-based listener (no downloads; the fallback and the unit-testable path)
// -----------------------------------------------------------------------------

/**
 * Keeps the microphone open and hands finished utterances to the caller. Half-duplex by
 * default: set the mode to `paused` while the assistant is thinking or speaking, or to
 * `guarded` to allow barge-in.
 */
export class HandsFreeListener implements SpeechListener {
  readonly kind = 'energy' as const;
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private buffer: Float32Array<ArrayBuffer> | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private frame = 0;
  private currentMode: ListenerMode = 'paused';
  private utteranceIsBargeIn = false;
  private readonly gate: VadGate;

  constructor(private readonly options: HandsFreeListenerOptions) {
    this.gate = new VadGate(options.config ?? DEFAULT_VAD_CONFIG);
  }

  get isActive(): boolean {
    return this.stream !== null;
  }

  get mode(): ListenerMode {
    return this.currentMode;
  }

  async start(): Promise<void> {
    if (this.stream) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.context = new AudioContext();
    const source = this.context.createMediaStreamSource(this.stream);
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 1024;
    source.connect(this.analyser);
    this.buffer = new Float32Array(this.analyser.fftSize);
    this.currentMode = 'listening';
    this.gate.guarded = false;
    this.gate.reset();
    this.tick();
  }

  setMode(mode: ListenerMode): void {
    if (mode === this.currentMode) return;
    this.currentMode = mode;
    this.discardRecording();
    this.gate.guarded = mode === 'guarded';
    this.gate.reset();
    if (mode === 'paused') this.options.onLevel?.(0);
  }

  stop(): void {
    cancelAnimationFrame(this.frame);
    this.discardRecording();
    this.analyser?.disconnect();
    this.analyser = null;
    void this.context?.close().catch(() => {});
    this.context = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.currentMode = 'paused';
    this.options.onLevel?.(0);
  }

  private tick = () => {
    if (!this.analyser || !this.buffer) return;
    this.frame = requestAnimationFrame(this.tick);
    if (this.currentMode === 'paused') return;

    this.analyser.getFloatTimeDomainData(this.buffer);
    const rms = rmsOf(this.buffer);
    this.options.onLevel?.(levelFromRms(rms));

    const event = this.gate.update(rms, performance.now());
    if (!event) return;
    switch (event.type) {
      case 'ready':
        this.options.onReady?.();
        break;
      case 'speech_start':
        this.utteranceIsBargeIn = this.currentMode === 'guarded';
        this.beginRecording();
        this.options.onSpeechStart?.(this.utteranceIsBargeIn);
        break;
      case 'speech_discard':
        this.discardRecording();
        break;
      case 'speech_end':
        void this.finishRecording(event.durationMs, event.peakLevel);
        break;
    }
  };

  private beginRecording(): void {
    if (!this.stream || this.recorder) return;
    const mimeType = pickMimeType();
    this.recorder = mimeType
      ? new MediaRecorder(this.stream, { mimeType, audioBitsPerSecond: 32_000 })
      : new MediaRecorder(this.stream);
    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start(250);
  }

  private discardRecording(): void {
    if (!this.recorder) return;
    this.recorder.ondataavailable = null;
    if (this.recorder.state !== 'inactive') this.recorder.stop();
    this.recorder = null;
    this.chunks = [];
  }

  private async finishRecording(durationMs: number, peakLevel: number): Promise<void> {
    const recorder = this.recorder;
    if (!recorder) return;
    this.recorder = null;
    const mimeType = recorder.mimeType || 'audio/webm';
    const stopped = new Promise<void>((resolve) =>
      recorder.addEventListener('stop', () => resolve(), { once: true })
    );
    recorder.stop();
    await stopped;
    const blob = new Blob(this.chunks, { type: mimeType.split(';')[0] ?? 'audio/webm' });
    this.chunks = [];
    if (blob.size > 0) {
      this.options.onUtterance({
        blob,
        durationMs,
        peakLevel,
        bargeIn: this.utteranceIsBargeIn,
      });
    }
  }
}
