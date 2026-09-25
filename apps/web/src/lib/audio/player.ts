import { blendVisemes, buildVisemeTimeline, visemesAt, type VisemeTimeline } from './text-visemes';
import { SILENT_VISEMES, visemesFromSpectrum, type VisemeWeights } from './visemes';

export type PlaybackEvent = 'play' | 'segment' | 'ended' | 'error' | 'stop';
type Listener = (event: PlaybackEvent) => void;

export interface PlaybackSegment {
  blob: Blob;
  /** Text the audio speaks; drives text-timed lip-sync when provided. */
  text?: string;
}

/**
 * Owns the single HTMLAudioElement used for the assistant's voice and the Web Audio
 * analyser that feeds lip-sync. Segments (one per sentence during a streamed reply) are
 * queued and played back to back; a whole reply can also be played as one blob.
 */
export class VoicePlayer {
  private element: HTMLAudioElement | null = null;
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private spectrum: Uint8Array<ArrayBuffer> | null = null;
  private objectUrl: string | null = null;
  private readonly listeners = new Set<Listener>();
  private readonly fftSize = 512;

  private queue: PlaybackSegment[] = [];
  private current: PlaybackSegment | null = null;
  private timeline: VisemeTimeline = [];
  /** True while more segments may still arrive for the current reply. */
  private open = false;
  private started = false;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get isPlaying(): boolean {
    return Boolean(this.element && !this.element.paused && !this.element.ended);
  }

  /** True between the first segment starting and the last one ending. */
  get isActive(): boolean {
    return this.started;
  }

  get currentText(): string | null {
    return this.current?.text ?? null;
  }

  /** Plays one blob, replacing anything current. Resolves when playback starts. */
  async play(blob: Blob, text?: string): Promise<void> {
    this.stop();
    this.open = false;
    this.queue = [{ blob, ...(text !== undefined ? { text } : {}) }];
    await this.playNext();
  }

  /** Plays a URL (used for the bundled fallback sound). */
  async playUrl(url: string): Promise<void> {
    this.stop();
    this.open = false;
    const element = this.ensureElement();
    element.src = url;
    this.current = { blob: new Blob() };
    this.timeline = [];
    await this.resumeContext();
    await element.play();
    this.markStarted();
  }

  /**
   * Begins a queued reply. Segments added with `enqueue` play in order; call `close` once
   * the last one has been added so the player can announce the end.
   */
  beginQueue(): void {
    this.stop();
    this.open = true;
    this.queue = [];
  }

  enqueue(segment: PlaybackSegment): void {
    this.queue.push(segment);
    if (!this.current) void this.playNext();
  }

  /** No more segments will be added; when the queue drains, playback ends. */
  close(): void {
    this.open = false;
    if (!this.current && this.queue.length === 0) this.finish();
  }

  stop(): void {
    const element = this.element;
    const wasActive = this.started;
    this.queue = [];
    this.open = false;
    this.current = null;
    this.timeline = [];
    this.started = false;
    if (element) {
      element.pause();
      element.removeAttribute('src');
      element.load();
    }
    this.revoke();
    if (wasActive) this.emit('stop');
  }

  /** Current lip-sync weights; silent when nothing is playing. */
  getVisemes(): VisemeWeights {
    if (!this.isPlaying || !this.analyser || !this.spectrum || !this.context) {
      return SILENT_VISEMES;
    }
    this.analyser.getByteFrequencyData(this.spectrum);
    const spectral = visemesFromSpectrum(this.spectrum, this.context.sampleRate, this.fftSize);
    if (this.timeline.length === 0 || !this.element) return spectral;
    return blendVisemes(visemesAt(this.timeline, this.element.currentTime), spectral);
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

  // ---------------------------------------------------------------------------

  private async playNext(): Promise<void> {
    const next = this.queue.shift();
    if (!next) {
      this.current = null;
      this.timeline = [];
      if (!this.open) this.finish();
      return;
    }
    const element = this.ensureElement();
    this.revoke();
    this.current = next;
    this.objectUrl = URL.createObjectURL(next.blob);
    element.src = this.objectUrl;
    this.timeline = [];
    await this.resumeContext();
    try {
      await element.play();
    } catch (error) {
      this.current = null;
      throw error;
    }
    if (next.text) {
      const duration = Number.isFinite(element.duration) ? element.duration : 0;
      this.timeline = buildVisemeTimeline(next.text, duration);
      if (duration === 0) {
        element.addEventListener(
          'durationchange',
          () => {
            if (this.current === next && Number.isFinite(element.duration)) {
              this.timeline = buildVisemeTimeline(next.text ?? '', element.duration);
            }
          },
          { once: true }
        );
      }
    }
    this.markStarted();
    this.emit('segment');
  }

  private markStarted(): void {
    if (this.started) return;
    this.started = true;
    this.emit('play');
  }

  private finish(): void {
    this.current = null;
    this.timeline = [];
    this.revoke();
    if (this.started) {
      this.started = false;
      this.emit('ended');
    }
  }

  private ensureElement(): HTMLAudioElement {
    if (this.element) return this.element;
    const element = document.createElement('audio');
    element.preload = 'auto';
    element.setAttribute('aria-hidden', 'true');
    element.style.display = 'none';
    element.addEventListener('ended', () => {
      void this.playNext();
    });
    element.addEventListener('error', () => {
      if (!this.current) return; // Errors after `stop()` cleared the source are expected.
      this.queue = [];
      this.open = false;
      this.current = null;
      this.started = false;
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
