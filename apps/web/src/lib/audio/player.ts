import { SILENT_VISEMES, visemesFromSpectrum, type VisemeWeights } from './visemes';

export type PlaybackEvent = 'play' | 'ended' | 'error' | 'stop';
type Listener = (event: PlaybackEvent) => void;

/**
 * Owns the single HTMLAudioElement used for the assistant's voice and the Web Audio
 * analyser that feeds lip-sync. Created lazily on the first user gesture so browsers do
 * not suspend the AudioContext.
 */
export class VoicePlayer {
  private element: HTMLAudioElement | null = null;
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private spectrum: Uint8Array<ArrayBuffer> | null = null;
  private objectUrl: string | null = null;
  private readonly listeners = new Set<Listener>();
  private readonly fftSize = 512;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get isPlaying(): boolean {
    return Boolean(this.element && !this.element.paused && !this.element.ended);
  }

  /** Plays a blob, replacing anything currently playing. Resolves when playback starts. */
  async play(blob: Blob): Promise<void> {
    const element = this.ensureElement();
    this.stop();
    this.objectUrl = URL.createObjectURL(blob);
    element.src = this.objectUrl;
    await this.resumeContext();
    await element.play();
    this.emit('play');
  }

  /** Plays a URL (used for the bundled fallback sound). */
  async playUrl(url: string): Promise<void> {
    const element = this.ensureElement();
    this.stop();
    element.src = url;
    await this.resumeContext();
    await element.play();
    this.emit('play');
  }

  stop(): void {
    const element = this.element;
    if (!element) return;
    const wasPlaying = this.isPlaying;
    element.pause();
    element.removeAttribute('src');
    element.load();
    this.revoke();
    if (wasPlaying) this.emit('stop');
  }

  /** Current lip-sync weights; silent when nothing is playing. */
  getVisemes(): VisemeWeights {
    if (!this.isPlaying || !this.analyser || !this.spectrum || !this.context) {
      return SILENT_VISEMES;
    }
    this.analyser.getByteFrequencyData(this.spectrum);
    return visemesFromSpectrum(this.spectrum, this.context.sampleRate, this.fftSize);
  }

  /** Loudness 0..1 for UI meters. */
  getLevel(): number {
    if (!this.isPlaying || !this.analyser || !this.spectrum) return 0;
    this.analyser.getByteFrequencyData(this.spectrum);
    let sum = 0;
    const bins = Math.min(this.spectrum.length, 48);
    for (let i = 1; i < bins; i += 1) sum += this.spectrum[i] ?? 0;
    return Math.min(1, sum / bins / 160);
  }

  dispose(): void {
    this.stop();
    this.analyser?.disconnect();
    void this.context?.close().catch(() => {});
    this.element?.remove();
    this.element = null;
    this.context = null;
    this.analyser = null;
    this.listeners.clear();
  }

  private ensureElement(): HTMLAudioElement {
    if (this.element) return this.element;
    const element = document.createElement('audio');
    element.preload = 'auto';
    element.setAttribute('aria-hidden', 'true');
    element.style.display = 'none';
    element.addEventListener('ended', () => {
      this.revoke();
      this.emit('ended');
    });
    element.addEventListener('error', () => {
      this.revoke();
      this.emit('error');
    });
    document.body.appendChild(element);
    this.element = element;
    this.connectAnalyser(element);
    return element;
  }

  private connectAnalyser(element: HTMLAudioElement): void {
    if (typeof AudioContext === 'undefined') return;
    try {
      this.context = new AudioContext();
      const source = this.context.createMediaElementSource(element);
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = this.fftSize;
      this.analyser.smoothingTimeConstant = 0.72;
      this.analyser.minDecibels = -85;
      this.analyser.maxDecibels = -10;
      source.connect(this.analyser);
      this.analyser.connect(this.context.destination);
      this.spectrum = new Uint8Array(this.analyser.frequencyBinCount);
    } catch {
      // Without an analyser the voice still plays; the mouth just stays still.
    }
  }

  private async resumeContext(): Promise<void> {
    if (this.context?.state === 'suspended') {
      await this.context.resume().catch(() => {});
    }
  }

  private revoke(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  private emit(event: PlaybackEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}

let shared: VoicePlayer | null = null;

/** The app-wide player; one element, one AudioContext. */
export function getVoicePlayer(): VoicePlayer {
  if (!shared) shared = new VoicePlayer();
  return shared;
}
