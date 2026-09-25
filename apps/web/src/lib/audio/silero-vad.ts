import { encodeWav, peakRms } from './wav';
import {
  HandsFreeListener,
  type HandsFreeListenerOptions,
  type ListenerMode,
  type SpeechListener,
} from './vad';

const SAMPLE_RATE = 16_000;
/** In guarded mode (Flare is speaking) only utterances at least this long count as barge-in. */
const GUARDED_MIN_MS = 600;

/**
 * Silero VAD (a small neural network) running on-device through ONNX Runtime Web. Far
 * more robust to background noise than the energy gate. Assets are served from /vad and
 * loaded on first use, so nothing is downloaded until hands-free is switched on.
 */
export class SileroListener implements SpeechListener {
  readonly kind = 'silero' as const;
  private vad: {
    start: () => Promise<void>;
    pause: () => Promise<void>;
    destroy: () => Promise<void>;
  } | null = null;
  private currentMode: ListenerMode = 'paused';
  private speechStartedAt = 0;
  private utteranceIsBargeIn = false;

  constructor(private readonly options: HandsFreeListenerOptions) {}

  get isActive(): boolean {
    return this.vad !== null;
  }

  get mode(): ListenerMode {
    return this.currentMode;
  }

  async start(): Promise<void> {
    if (this.vad) return;
    const { MicVAD } = await import('@ricky0123/vad-web');
    const vad = await MicVAD.new({
      model: 'v5',
      baseAssetPath: '/vad/',
      onnxWASMBasePath: '/vad/',
      startOnLoad: false,
      positiveSpeechThreshold: 0.55,
      negativeSpeechThreshold: 0.3,
      redemptionMs: 700,
      preSpeechPadMs: 250,
      minSpeechMs: 300,
      submitUserSpeechOnPause: false,
      onFrameProcessed: (probabilities) => {
        if (this.currentMode !== 'paused') this.options.onLevel?.(probabilities.isSpeech);
      },
      onSpeechStart: () => {
        this.speechStartedAt = performance.now();
        this.utteranceIsBargeIn = this.currentMode === 'guarded';
        this.options.onSpeechStart?.(this.utteranceIsBargeIn);
      },
      onVADMisfire: () => {
        this.options.onLevel?.(0);
      },
      onSpeechEnd: (audio) => {
        if (this.currentMode === 'paused') return;
        const durationMs = (audio.length / SAMPLE_RATE) * 1000;
        if (this.utteranceIsBargeIn && durationMs < GUARDED_MIN_MS) return;
        this.options.onUtterance({
          blob: encodeWav(audio, SAMPLE_RATE),
          durationMs,
          peakLevel: peakRms(audio, SAMPLE_RATE),
          bargeIn: this.utteranceIsBargeIn,
        });
      },
    });
    this.vad = vad;
    await vad.start();
    this.currentMode = 'listening';
    this.options.onReady?.();
  }

  setMode(mode: ListenerMode): void {
    if (mode === this.currentMode || !this.vad) return;
    const wasPaused = this.currentMode === 'paused';
    this.currentMode = mode;
    if (mode === 'paused') {
      void this.vad.pause();
      this.options.onLevel?.(0);
    } else if (wasPaused) {
      void this.vad.start();
    }
  }

  stop(): void {
    const vad = this.vad;
    this.vad = null;
    this.currentMode = 'paused';
    this.options.onLevel?.(0);
    void vad?.destroy().catch(() => {});
  }
}

/**
 * Starts the best available listener: the neural detector when allowed and loadable, else
 * the energy gate. Resolves once the microphone is open and detection is running.
 */
export async function startSpeechListener(
  options: HandsFreeListenerOptions,
  preferNeural: boolean
): Promise<SpeechListener> {
  if (preferNeural) {
    const neural = new SileroListener(options);
    try {
      await neural.start();
      return neural;
    } catch (error) {
      // A permission denial must surface; a download or runtime failure falls back.
      if (error instanceof DOMException && error.name === 'NotAllowedError') throw error;
      neural.stop();
    }
  }
  const energy = new HandsFreeListener(options);
  await energy.start();
  return energy;
}
