/**
 * Text processing utilities for KittenTTS Web
 * 
 * Note: This is a simplified implementation for demonstration purposes.
 * The actual KittenTTS uses espeak phonemizer for proper text preprocessing.
 */

// Character mapping based on KittenTTS TextCleaner (matching official implementation)
const createCharacterMap = () => {
  const pad = '$';
  const punctuation = ';:,.!?¡¿—…"«»"" ';
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const lettersIpa = "ɑɐɒæɓʙβɔɕçɗɖðʤəɘɚɛɜɝɞɟʄɡɠɢʛɦɧħɥʜɨɪʝɭɬɫɮʟɱɯɰŋɳɲɴøɵɸθœɶʘɹɺɾɻʀʁɽʂʃʈʧʉʊʋⱱʌɣɤʍχʎʏʑʐʒʔʡʕʢǀǁǂǃˈˌːˑʼʴʰʱʲʷˠˤ˞↓↑→↗↘'̩'ᵻ";
  
  // Exact order from KittenTTS: [_pad] + list(_punctuation) + list(_letters) + list(_letters_ipa)
  const symbols = [pad, ...Array.from(punctuation), ...Array.from(letters), ...Array.from(lettersIpa)];
  
  const charMap = new Map<string, number>();
  symbols.forEach((char, index) => {
    charMap.set(char, index);
  });
  
  return charMap;
};

const CHAR_MAP = createCharacterMap();

/**
 * Basic English tokenizer (simplified version of official implementation)
 * Note: This is a fallback implementation. Official TTS uses espeak phonemizer.
 */
function basicEnglishTokenize(text: string): string[] {
  // Simplified version of the regex from official implementation: r"\w+|[^\w\s]"
  return text.match(/\w+|[^\w\s]/g) || [];
}

/**
 * Text cleaner based on official KittenTTS implementation
 */
export function simpleTokenizer(text: string): number[] {
  // For demonstration, we'll do basic tokenization without full phonemization
  // In a real implementation, you'd use espeak phonemizer first
  
  const tokens: number[] = [];
  
  // Simple approach: tokenize each character using the official character map
  for (const char of text) {
    const token = CHAR_MAP.get(char);
    if (token !== undefined) {
      tokens.push(token);
    }
    // Skip unknown characters (same behavior as official TextCleaner.__call__)
  }
  
  return tokens;
}

/**
 * Alternative tokenizer that tries to match the official approach more closely
 */
export function advancedTokenizer(text: string): number[] {
  // Basic tokenization step (simplified phoneme simulation)
  const words = basicEnglishTokenize(text.toLowerCase());
  const phonemeText = words.join(' ');
  
  const tokens: number[] = [];
  for (const char of phonemeText) {
    const token = CHAR_MAP.get(char);
    if (token !== undefined) {
      tokens.push(token);
    }
  }
  
  return tokens;
}

/**
 * Basic text preprocessing
 */
export function preprocessText(text: string): string {
  // Convert to lowercase
  let processed = text.toLowerCase();
  
  // Normalize whitespace
  processed = processed.replace(/\s+/g, ' ').trim();
  
  // Expand common abbreviations
  const abbreviations: { [key: string]: string } = {
    "don't": "do not",
    "won't": "will not",
    "can't": "cannot",
    "i'm": "i am",
    "you're": "you are",
    "it's": "it is",
    "that's": "that is",
    "there's": "there is",
    "what's": "what is",
    "where's": "where is",
    "how's": "how is",
    "here's": "here is"
  };
  
  for (const [abbrev, expansion] of Object.entries(abbreviations)) {
    processed = processed.replace(new RegExp(`\\b${abbrev}\\b`, 'g'), expansion);
  }
  
  return processed;
}

/**
 * Generate mock voice embeddings for different voice types
 * Based on the structure from official KittenTTS voices.npz
 */
export function generateVoiceEmbedding(voiceType: string, embeddingSize: number = 256): Float32Array {
  const embedding = new Float32Array(embeddingSize);
  
  // Create more realistic embeddings based on voice characteristics
  const voiceParams = getVoiceParameters(voiceType);
  
  // Generate embeddings with voice-specific patterns
  for (let i = 0; i < embeddingSize; i++) {
    const t = i / embeddingSize;
    
    // Base pattern
    let value = Math.sin(voiceParams.frequency * t * Math.PI) * voiceParams.amplitude;
    
    // Add harmonics for voice characteristics
    value += Math.sin(voiceParams.frequency * 2 * t * Math.PI) * voiceParams.amplitude * 0.3;
    value += Math.sin(voiceParams.frequency * 3 * t * Math.PI) * voiceParams.amplitude * 0.1;
    
    // Add noise for naturalness
    value += (Math.random() - 0.5) * voiceParams.noise;
    
    // Gender-specific modifications
    if (voiceParams.gender === 'female') {
      value += Math.cos(t * Math.PI * 4) * 0.02;
    } else {
      value += Math.cos(t * Math.PI * 2) * 0.03;
    }
    
    embedding[i] = value;
  }
  
  // Normalize to typical embedding range
  const mean = embedding.reduce((sum, val) => sum + val, 0) / embeddingSize;
  const variance = embedding.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / embeddingSize;
  const std = Math.sqrt(variance);
  
  for (let i = 0; i < embeddingSize; i++) {
    embedding[i] = (embedding[i] - mean) / (std + 1e-6) * 0.1; // Scale to reasonable range
  }
  
  return embedding;
}

/**
 * Get voice-specific parameters for embedding generation
 */
function getVoiceParameters(voiceType: string) {
  const voiceConfigs: Record<string, { frequency: number; amplitude: number; noise: number; gender: string }> = {
    'expr-voice-2-m': { frequency: 2, amplitude: 0.15, noise: 0.02, gender: 'male' },
    'expr-voice-2-f': { frequency: 3, amplitude: 0.12, noise: 0.015, gender: 'female' },
    'expr-voice-3-m': { frequency: 2.2, amplitude: 0.18, noise: 0.025, gender: 'male' },
    'expr-voice-3-f': { frequency: 3.5, amplitude: 0.14, noise: 0.018, gender: 'female' },
    'expr-voice-4-m': { frequency: 1.8, amplitude: 0.16, noise: 0.022, gender: 'male' },
    'expr-voice-4-f': { frequency: 3.2, amplitude: 0.13, noise: 0.016, gender: 'female' },
    'expr-voice-5-m': { frequency: 2.5, amplitude: 0.17, noise: 0.028, gender: 'male' },
    'expr-voice-5-f': { frequency: 3.8, amplitude: 0.11, noise: 0.014, gender: 'female' },
  };
  
  return voiceConfigs[voiceType] || voiceConfigs['expr-voice-2-f'];
}

/**
 * Available voice types (mock implementation)
 */
export const AVAILABLE_VOICES = [
  { id: 'expr-voice-2-m', name: 'Male Voice 1', gender: 'male' },
  { id: 'expr-voice-2-f', name: 'Female Voice 1', gender: 'female' },
  { id: 'expr-voice-3-m', name: 'Male Voice 2', gender: 'male' },
  { id: 'expr-voice-3-f', name: 'Female Voice 2', gender: 'female' },
  { id: 'expr-voice-4-m', name: 'Male Voice 3', gender: 'male' },
  { id: 'expr-voice-4-f', name: 'Female Voice 3', gender: 'female' },
  { id: 'expr-voice-5-m', name: 'Male Voice 4', gender: 'male' },
  { id: 'expr-voice-5-f', name: 'Female Voice 4', gender: 'female' },
] as const;

export type VoiceId = typeof AVAILABLE_VOICES[number]['id'];