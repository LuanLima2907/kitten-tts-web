/**
 * Audio utilities for KittenTTS Web
 */

/**
 * Creates a WAV file ArrayBuffer from Float32Array audio data
 */
export function createWavFile(audioData: Float32Array, sampleRate: number): ArrayBuffer {
  const length = audioData.length;
  const arrayBuffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(arrayBuffer);
  
  // WAV header helper
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  // WAV header
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);  // PCM
  view.setUint16(22, 1, true);  // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length * 2, true);
  
  // Convert float32 to int16
  let offset = 44;
  for (let i = 0; i < length; i++) {
    const sample = Math.max(-1, Math.min(1, audioData[i]));
    view.setInt16(offset, sample * 0x7FFF, true);
    offset += 2;
  }
  
  return arrayBuffer;
}

/**
 * Gentle audio normalization with noise reduction
 */
export function normalizeAudio(audioData: Float32Array): Float32Array {
  const length = audioData.length;
  const normalized = new Float32Array(length);
  
  // Calculate RMS for better normalization
  let rms = 0;
  for (let i = 0; i < length; i++) {
    rms += audioData[i] * audioData[i];
  }
  rms = Math.sqrt(rms / length);
  
  if (rms < 1e-10) {
    // Return copy to avoid mutation
    return new Float32Array(audioData);
  }
  
  // Gentle normalization to -12dB peak (0.25 scale)
  const targetRMS = 0.1;  // Conservative target to avoid over-amplification
  const scale = Math.min(targetRMS / rms, 0.95); // Cap at 0.95 to prevent clipping
  
  for (let i = 0; i < length; i++) {
    normalized[i] = audioData[i] * scale;
  }
  
  return normalized;
}

/**
 * Apply fade in/out to prevent clicks
 */
export function applyFades(audioData: Float32Array, fadeLength: number = 1000): Float32Array {
  const result = new Float32Array(audioData);
  const length = audioData.length;
  
  // Fade in
  for (let i = 0; i < Math.min(fadeLength, length / 2); i++) {
    const factor = i / fadeLength;
    result[i] *= factor;
  }
  
  // Fade out
  for (let i = Math.max(0, length - fadeLength); i < length; i++) {
    const factor = (length - i) / fadeLength;
    result[i] *= factor;
  }
  
  return result;
}

/**
 * Download audio as WAV file
 */
export function downloadAudio(audioData: Float32Array, filename: string = 'kitten-tts-output.wav', sampleRate: number = 24000) {
  const wavBuffer = createWavFile(audioData, sampleRate);
  const blob = new Blob([wavBuffer], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}