/**
 * Voice embeddings loader for KittenTTS
 * Loads real voice embeddings from voices.json
 */

export interface VoiceData {
  [key: string]: number[][];
}

let cachedVoices: VoiceData | null = null;

/**
 * Load voice embeddings from voices.json
 */
export async function loadVoices(): Promise<VoiceData> {
  if (cachedVoices) {
    return cachedVoices;
  }

  try {
    const response = await fetch('/voices.json');
    if (!response.ok) {
      throw new Error(`Failed to load voices: ${response.status}`);
    }
    
    const voices = await response.json();
    cachedVoices = voices;
    
    console.log('Loaded voices:', Object.keys(voices));
    return voices;
  } catch (error) {
    console.error('Error loading voices:', error);
    throw new Error('Failed to load voice embeddings');
  }
}

/**
 * Get voice embedding as Float32Array
 */
export function getVoiceEmbedding(voices: VoiceData, voiceId: string): Float32Array {
  const voiceData = voices[voiceId];
  if (!voiceData || !voiceData[0]) {
    throw new Error(`Voice '${voiceId}' not found`);
  }
  
  // Convert the 2D array to 1D Float32Array (voices are stored as [1, 256] shape)
  return new Float32Array(voiceData[0]);
}

/**
 * Check if voices are available
 */
export function areVoicesLoaded(): boolean {
  return cachedVoices !== null;
}

/**
 * Get available voice IDs
 */
export function getAvailableVoiceIds(): string[] {
  if (!cachedVoices) {
    return [];
  }
  return Object.keys(cachedVoices);
}