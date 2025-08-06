import React, { useState, useCallback, useRef, useEffect } from 'react';
import * as ort from 'onnxruntime-web';
import { createWavFile, downloadAudio } from '../utils/audioUtils';
import { simpleTokenizer, advancedTokenizer, preprocessText, AVAILABLE_VOICES, type VoiceId } from '../utils/textUtils';
import { loadVoices, getVoiceEmbedding, type VoiceData } from '../utils/voiceLoader';
import { EXAMPLE_TEXTS } from '../data/exampleTexts';
import { 
  downloadAndCacheModel, 
  isModelCached, 
  getCacheInfo, 
  clearCachedModel, 
  clearAllCache, 
  getCacheSize, 
  formatBytes,
  type CacheInfo 
} from '../utils/modelCache';

interface KittenTTSProps {
  className?: string;
}

const KittenTTS: React.FC<KittenTTSProps> = ({ className }) => {
  const [text, setText] = useState('Hello, this is a test of KittenTTS running in the browser!');
  const [selectedVoice, setSelectedVoice] = useState<VoiceId>('expr-voice-2-f');
  const [speed, setSpeed] = useState(1.0);
  const [useAdvancedTokenizer, setUseAdvancedTokenizer] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [inferenceTime, setInferenceTime] = useState<number | null>(null);
  const [modelUrl, setModelUrl] = useState('https://huggingface.co/KittenML/kitten-tts-nano-0.1/resolve/main/kitten_tts_nano_v0_1.onnx');
  const [currentModelUrl, setCurrentModelUrl] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [isCached, setIsCached] = useState<boolean>(false);
  const [cacheInfo, setCacheInfo] = useState<CacheInfo[]>([]);
  const [cacheSize, setCacheSize] = useState<number>(0);
  
  const sessionRef = useRef<ort.InferenceSession | null>(null);
  const voicesRef = useRef<VoiceData | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const currentAudioDataRef = useRef<Float32Array | null>(null);

  // Load cache info on component mount and when modelUrl changes
  useEffect(() => {
    const updateCacheInfo = async () => {
      try {
        const [info, size, cached] = await Promise.all([
          getCacheInfo(),
          getCacheSize(),
          isModelCached(modelUrl)
        ]);
        setCacheInfo(info);
        setCacheSize(size);
        setIsCached(cached);
      } catch (error) {
        console.error('Error loading cache info:', error);
      }
    };
    
    updateCacheInfo();
  }, [modelUrl]);

  const loadModel = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setDownloadProgress(0);
      
      console.log('Loading model and voices...');
      console.log('Model URL:', modelUrl);
      
      // Validate URL format
      let resolvedUrl = modelUrl.trim();
      if (!resolvedUrl) {
        throw new Error('Model URL cannot be empty');
      }
      
      // If it's a relative path, keep it as is. If it's a full URL, validate it.
      if (!resolvedUrl.startsWith('/') && !resolvedUrl.startsWith('http')) {
        throw new Error('Model URL must be either a relative path (starting with /) or a full HTTP(S) URL');
      }
      
      // Load voices first (parallel with model loading)
      const voicesPromise = loadVoices();
      
      let modelData: ArrayBuffer;
      
      // Check if it's a remote URL that can be cached
      if (resolvedUrl.startsWith('http')) {
        // Use cached download for remote URLs
        modelData = await downloadAndCacheModel(resolvedUrl, (progress) => {
          setDownloadProgress(progress);
        });
      } else {
        // For local paths, fetch normally (no caching needed)
        const response = await fetch(resolvedUrl);
        if (!response.ok) {
          throw new Error(`Failed to load model: ${response.status} ${response.statusText}`);
        }
        modelData = await response.arrayBuffer();
      }
      
      // Create ONNX session from the model data
      const session = await ort.InferenceSession.create(modelData, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });
      
      // Wait for voices to finish loading
      const voices = await voicesPromise;
      
      sessionRef.current = session;
      voicesRef.current = voices;
      setIsModelLoaded(true);
      setCurrentModelUrl(resolvedUrl);
      setDownloadProgress(100);
      
      // Update cache info
      const [info, size, cached] = await Promise.all([
        getCacheInfo(),
        getCacheSize(),
        isModelCached(resolvedUrl)
      ]);
      setCacheInfo(info);
      setCacheSize(size);
      setIsCached(cached);
      
      console.log('Model loaded successfully from:', resolvedUrl);
      console.log('Input names:', session.inputNames);
      console.log('Output names:', session.outputNames);
      console.log('Available voices:', Object.keys(voices));
      
    } catch (err) {
      console.error('Error loading model or voices:', err);
      setError(`Failed to load model/voices: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setCurrentModelUrl(null);
      setDownloadProgress(0);
    } finally {
      setIsLoading(false);
    }
  }, [modelUrl]);

  const generateSpeech = useCallback(async () => {
    if (!sessionRef.current) {
      setError('Model not loaded');
      return;
    }

    if (!voicesRef.current) {
      setError('Voice embeddings not loaded');
      return;
    }

    if (!text.trim()) {
      setError('Please enter some text');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setInferenceTime(null);
      
      const startTime = performance.now();
      
      // Preprocess text
      const processedText = preprocessText(text);
      
      // Tokenize using selected method
      const tokens = useAdvancedTokenizer 
        ? advancedTokenizer(processedText)
        : simpleTokenizer(processedText);
      
      if (tokens.length === 0) {
        throw new Error('No valid tokens found in text');
      }
      
      // Add padding tokens (start and end) - matching official implementation
      const paddedTokens = [0, ...tokens, 0];
      console.log('Token count:', paddedTokens.length, 'First 10 tokens:', paddedTokens.slice(0, 10));
      
      if (paddedTokens.length > 1000) {
        throw new Error('Text too long - please use shorter text');
      }
      
      const inputIds = new ort.Tensor('int64', BigInt64Array.from(paddedTokens.map(t => BigInt(t))), [1, paddedTokens.length]);
      
      // Use real voice embedding from loaded voices.json
      console.log('Getting voice embedding for:', selectedVoice);
      const voiceEmbedding = getVoiceEmbedding(voicesRef.current, selectedVoice);
      
      if (!voiceEmbedding || voiceEmbedding.length !== 256) {
        throw new Error(`Invalid voice embedding for ${selectedVoice}`);
      }
      
      const styleTensor = new ort.Tensor('float32', voiceEmbedding, [1, 256]);
      
      // Speed parameter - matching official implementation
      const speedTensor = new ort.Tensor('float32', Float32Array.from([speed]), [1]);
      
      // Run inference
      const inputs = {
        input_ids: inputIds,
        style: styleTensor,
        speed: speedTensor,
      };
      
      console.log('Running inference with REAL voice embeddings:', {
        input_ids: inputIds.dims,
        style: styleTensor.dims,
        speed: speedTensor.dims,
        voice: selectedVoice,
        speed_value: speed
      });
      
      const outputs = await sessionRef.current.run(inputs);
      
      const inferenceEndTime = performance.now();
      const inferenceTimeMs = inferenceEndTime - startTime;
      setInferenceTime(inferenceTimeMs);
      
      console.log(`Inference completed in ${inferenceTimeMs.toFixed(2)}ms`);
      console.log('Output keys:', Object.keys(outputs));
      
      // Get the audio output
      const audioOutput = outputs[sessionRef.current.outputNames[0]];
      let audioData = audioOutput.data as Float32Array;
      
      console.log('Raw audio data length:', audioData.length);
      
      // Safe way to find min/max without stack overflow for large arrays
      let minVal = audioData[0];
      let maxVal = audioData[0];
      for (let i = 1; i < audioData.length; i++) {
        if (audioData[i] < minVal) minVal = audioData[i];
        if (audioData[i] > maxVal) maxVal = audioData[i];
      }
      console.log('Audio data range:', minVal, 'to', maxVal);
      
      // Apply trimming like the official implementation
      // Official code: audio = outputs[0][5000:-10000]
      const originalLength = audioData.length;
      const trimStart = Math.min(5000, originalLength);
      const trimEnd = Math.min(10000, originalLength);
      
      if (originalLength > trimStart + trimEnd) {
        audioData = audioData.slice(trimStart, originalLength - trimEnd);
        console.log(`Trimmed audio from ${originalLength} to ${audioData.length} samples`);
      }
      
      // Apply minimal audio processing to avoid stack overflow
      // Skip normalization and fades for now to debug the issue
      console.log('Skipping audio processing to avoid stack overflow');
      
      // Store current audio data for download
      currentAudioDataRef.current = audioData;
      
      // Convert to WAV format and create URL
      const audioBuffer = createWavFile(audioData, 24000); // KittenTTS uses 24kHz sample rate
      const blob = new Blob([audioBuffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      
      // Clean up previous audio URL - but don't include audioUrl in dependencies
      const currentAudioUrl = audioUrl;
      if (currentAudioUrl) {
        URL.revokeObjectURL(currentAudioUrl);
      }
      
      setAudioUrl(url);
      
    } catch (err) {
      console.error('Error generating speech:', err);
      setError(`Failed to generate speech: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [text, selectedVoice, speed, useAdvancedTokenizer]); // Removed audioUrl from dependencies to prevent circular dependency

  const playAudio = () => {
    if (audioRef.current && audioUrl) {
      audioRef.current.play();
    }
  };

  const handleDownload = () => {
    if (currentAudioDataRef.current) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      downloadAudio(currentAudioDataRef.current, `kitten-tts-${timestamp}.wav`);
    }
  };

  return (
    <div className={className}>
      <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h2>🐱 KittenTTS Web Demo</h2>
        
        {!isModelLoaded && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ marginBottom: '15px' }}>
              <label htmlFor="model-url-input" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                ONNX Model URL:
              </label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <input
                    id="model-url-input"
                    type="text"
                    value={modelUrl}
                    onChange={(e) => setModelUrl(e.target.value)}
                    placeholder="Enter ONNX model URL or path"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '14px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontFamily: 'monospace',
                    }}
                  />
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                    Use relative path (e.g., /model.onnx) or full URL (https://example.com/model.onnx)
                    {modelUrl.startsWith('http') && (
                      <span style={{ 
                        marginLeft: '8px',
                        fontWeight: 'bold',
                        color: isCached ? '#28a745' : '#6c757d'
                      }}>
                        {isCached ? '✅ Cached' : '💾 Will be cached'}
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', color: '#666', marginRight: '4px' }}>Quick URLs:</span>
                    <button
                      onClick={() => setModelUrl('https://huggingface.co/mush42/kitten_tts_nano/resolve/main/kitten_tts_nano_v0_1.onnx')}
                      style={{
                        padding: '2px 6px',
                        fontSize: '11px',
                        backgroundColor: '#e9ecef',
                        color: '#495057',
                        border: '1px solid #ced4da',
                        borderRadius: '3px',
                        cursor: 'pointer',
                      }}
                    >
                      HuggingFace
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={loadModel}
                disabled={isLoading || !modelUrl.trim()}
                style={{
                  padding: '10px 20px',
                  fontSize: '16px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: (isLoading || !modelUrl.trim()) ? 'not-allowed' : 'pointer',
                  opacity: (isLoading || !modelUrl.trim()) ? 0.6 : 1,
                }}
              >
                {isLoading ? (isCached ? 'Loading from Cache...' : 'Downloading & Caching...') : 'Load KittenTTS Model'}
              </button>
              
              {cacheSize > 0 && (
                <button
                  onClick={async () => {
                    try {
                      await clearAllCache();
                      const [info, size] = await Promise.all([getCacheInfo(), getCacheSize()]);
                      setCacheInfo(info);
                      setCacheSize(size);
                      setIsCached(false);
                    } catch (error) {
                      console.error('Error clearing cache:', error);
                    }
                  }}
                  disabled={isLoading}
                  style={{
                    padding: '8px 16px',
                    fontSize: '14px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    opacity: isLoading ? 0.6 : 1,
                  }}
                >
                  Clear Cache ({formatBytes(cacheSize)})
                </button>
              )}
            </div>
            
            {isLoading && downloadProgress > 0 && downloadProgress < 100 && (
              <div style={{ marginTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', color: '#666' }}>Download Progress</span>
                  <span style={{ fontSize: '12px', color: '#666' }}>{downloadProgress.toFixed(1)}%</span>
                </div>
                <div style={{
                  width: '100%',
                  height: '6px',
                  backgroundColor: '#e9ecef',
                  borderRadius: '3px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${downloadProgress}%`,
                    height: '100%',
                    backgroundColor: '#007bff',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            )}
          </div>
        )}
        
        {isModelLoaded && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label htmlFor="text-input" style={{ fontWeight: 'bold' }}>
                  Text to Speech:
                </label>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      const example = EXAMPLE_TEXTS.find(ex => ex.title === e.target.value);
                      if (example) {
                        setText(example.text);
                      }
                    }
                  }}
                  style={{
                    padding: '4px 8px',
                    fontSize: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    backgroundColor: 'white',
                  }}
                  defaultValue=""
                >
                  <option value="">Load Example...</option>
                  {EXAMPLE_TEXTS.map((example) => (
                    <option key={example.title} value={example.title}>
                      {example.title}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                id="text-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '100px',
                  padding: '10px',
                  fontSize: '14px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
                placeholder="Enter text to synthesize..."
              />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>
              <div>
                <label htmlFor="voice-select" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Voice:
                </label>
                <select
                  id="voice-select"
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value as VoiceId)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '14px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    backgroundColor: 'white',
                  }}
                >
                  {AVAILABLE_VOICES.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name} ({voice.gender})
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label htmlFor="speed-input" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Speed: {speed.toFixed(1)}x
                </label>
                <input
                  id="speed-input"
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  style={{
                    width: '100%',
                    margin: '8px 0',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666' }}>
                  <span>0.5x</span>
                  <span>1.0x</span>
                  <span>2.0x</span>
                </div>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Tokenizer:
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0' }}>
                  <input
                    id="advanced-tokenizer"
                    type="checkbox"
                    checked={useAdvancedTokenizer}
                    onChange={(e) => setUseAdvancedTokenizer(e.target.checked)}
                    style={{ margin: 0 }}
                  />
                  <label htmlFor="advanced-tokenizer" style={{ fontSize: '14px', margin: 0, cursor: 'pointer' }}>
                    Advanced processing
                  </label>
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {useAdvancedTokenizer ? 'Word-based tokenization' : 'Character-based tokenization'}
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <button
                onClick={generateSpeech}
                disabled={isLoading || !text.trim()}
                style={{
                  padding: '12px 24px',
                  fontSize: '16px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: (isLoading || !text.trim()) ? 'not-allowed' : 'pointer',
                  opacity: (isLoading || !text.trim()) ? 0.6 : 1,
                  fontWeight: '500',
                  minWidth: '140px',
                }}
              >
                {isLoading ? 'Generating...' : '🎤 Generate'}
              </button>
              
              {audioUrl && (
                <>
                  <button
                    onClick={playAudio}
                    style={{
                      padding: '12px 24px',
                      fontSize: '16px',
                      backgroundColor: '#17a2b8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '500',
                      minWidth: '120px',
                    }}
                  >
                    ▶️ Play
                  </button>
                  
                  <button
                    onClick={handleDownload}
                    style={{
                      padding: '12px 24px',
                      fontSize: '16px',
                      backgroundColor: '#6f42c1',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '500',
                      minWidth: '120px',
                    }}
                  >
                    📥 Download
                  </button>
                </>
              )}
            </div>
            
            {audioUrl && (
              <div style={{ marginBottom: '20px' }}>
                <audio 
                  ref={audioRef} 
                  src={audioUrl} 
                  controls 
                  style={{ 
                    width: '100%', 
                    height: '40px',
                    borderRadius: '4px',
                  }} 
                />
                {inferenceTime && (
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#666', 
                    marginTop: '8px',
                    textAlign: 'center' 
                  }}>
                    Generated in {inferenceTime.toFixed(0)}ms
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {error && (
          <div
            style={{
              padding: '10px',
              backgroundColor: '#f8d7da',
              color: '#721c24',
              border: '1px solid #f5c6cb',
              borderRadius: '4px',
              marginBottom: '20px',
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        )}
        
        <div style={{ 
          fontSize: '13px', 
          color: '#666', 
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#f8f9fa',
          borderRadius: '6px',
          border: '1px solid #e9ecef'
        }}>
          <div style={{ marginBottom: '10px' }}>
            <strong>📝 Implementation Notes:</strong>
          </div>
          <ul style={{ margin: '0', paddingLeft: '20px' }}>
            <li>This is a simplified web implementation for demonstration</li>
            <li>Uses basic character tokenization instead of proper phonemization</li>
            <li>{voicesRef.current ? '✅ Using REAL voice embeddings from voices.npz' : '❌ Voice embeddings not loaded yet'}</li>
            <li>Audio quality should be much improved with real voice data</li>
          </ul>
          <div style={{ 
            marginTop: '10px', 
            paddingTop: '10px', 
            borderTop: '1px solid #e9ecef',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
              marginBottom: '10px'
            }}>
              <div>
                <strong>Model Status:</strong> {isModelLoaded ? '✅ Loaded' : '❌ Not loaded'}
              </div>
              <div>
                <strong>Voice Embeddings:</strong> {voicesRef.current ? '✅ Real voices loaded' : '❌ Not loaded'}
              </div>
            </div>
            
            {currentModelUrl && (
              <div style={{ 
                fontSize: '12px', 
                color: '#495057',
                backgroundColor: '#f8f9fa',
                padding: '8px',
                borderRadius: '4px',
                marginBottom: '10px',
                fontFamily: 'monospace',
                wordBreak: 'break-all'
              }}>
                <strong>Current Model:</strong> {currentModelUrl}
                {currentModelUrl.startsWith('http') && (
                  <span style={{ 
                    marginLeft: '8px',
                    color: isCached ? '#28a745' : '#6c757d',
                    fontFamily: 'system-ui'
                  }}>
                    ({isCached ? 'Cached' : 'Not cached'})
                  </span>
                )}
              </div>
            )}
            
            {cacheSize > 0 && (
              <div style={{ 
                fontSize: '12px', 
                color: '#495057',
                backgroundColor: '#e3f2fd',
                padding: '8px',
                borderRadius: '4px',
                marginBottom: '10px',
                border: '1px solid #bbdefb'
              }}>
                <div style={{ marginBottom: '4px' }}>
                  <strong>📦 Cache Status:</strong> {cacheInfo.length} model{cacheInfo.length !== 1 ? 's' : ''} cached ({formatBytes(cacheSize)})
                </div>
                {cacheInfo.length > 0 && (
                  <details style={{ marginTop: '4px' }}>
                    <summary style={{ cursor: 'pointer', fontSize: '11px', color: '#666' }}>
                      View cached models
                    </summary>
                    <div style={{ marginTop: '6px', paddingLeft: '8px' }}>
                      {cacheInfo.map((info, index) => (
                        <div key={index} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          fontSize: '11px',
                          marginBottom: '4px',
                          paddingBottom: '4px',
                          borderBottom: index < cacheInfo.length - 1 ? '1px solid #e0e0e0' : 'none'
                        }}>
                          <div style={{ 
                            flex: 1, 
                            wordBreak: 'break-all', 
                            marginRight: '8px',
                            fontFamily: 'monospace'
                          }}>
                            {info.url.length > 50 ? `...${info.url.slice(-50)}` : info.url}
                          </div>
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px',
                            whiteSpace: 'nowrap'
                          }}>
                            <span style={{ color: '#666' }}>
                              {formatBytes(info.size)}
                            </span>
                            <button
                              onClick={async () => {
                                try {
                                  await clearCachedModel(info.url);
                                  const [newInfo, newSize, cached] = await Promise.all([
                                    getCacheInfo(),
                                    getCacheSize(),
                                    isModelCached(modelUrl)
                                  ]);
                                  setCacheInfo(newInfo);
                                  setCacheSize(newSize);
                                  setIsCached(cached);
                                } catch (error) {
                                  console.error('Error clearing cached model:', error);
                                }
                              }}
                              style={{
                                padding: '2px 6px',
                                fontSize: '10px',
                                backgroundColor: '#dc3545',
                                color: 'white',
                                border: 'none',
                                borderRadius: '2px',
                                cursor: 'pointer',
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
            
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
              fontSize: '12px'
            }}>
              {isModelLoaded && sessionRef.current && (
                <div>
                  Inputs: {sessionRef.current.inputNames.join(', ')} | 
                  Outputs: {sessionRef.current.outputNames.join(', ')}
                </div>
              )}
              {voicesRef.current && (
                <div>
                  Available voices: {Object.keys(voicesRef.current).length} loaded
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KittenTTS;