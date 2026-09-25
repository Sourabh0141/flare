/** Encodes mono float samples as a 16-bit PCM WAV blob (what the transcription API accepts). */
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const dataLength = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(offset, Math.round(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff), true);
    offset += bytesPerSample;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/** Peak RMS over 20 ms windows, for the same silence check the recorder path uses. */
export function peakRms(samples: Float32Array, sampleRate: number): number {
  const window = Math.max(1, Math.floor(sampleRate * 0.02));
  let peak = 0;
  for (let start = 0; start < samples.length; start += window) {
    let sum = 0;
    const end = Math.min(samples.length, start + window);
    for (let i = start; i < end; i += 1) {
      const s = samples[i] ?? 0;
      sum += s * s;
    }
    peak = Math.max(peak, Math.sqrt(sum / (end - start)));
  }
  return peak;
}
