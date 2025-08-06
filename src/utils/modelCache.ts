/**
 * ONNX Model Cache utilities using IndexedDB
 * Caches downloaded ONNX models to avoid re-downloading
 */

interface CachedModel {
  url: string;
  data: ArrayBuffer;
  timestamp: number;
  size: number;
}

export interface CacheInfo {
  url: string;
  timestamp: number;
  size: number;
}

const DB_NAME = 'KittenTTSCache';
const DB_VERSION = 1;
const STORE_NAME = 'models';

/**
 * Initialize IndexedDB for model caching
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'url' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

/**
 * Get cached model data
 */
export async function getCachedModel(url: string): Promise<ArrayBuffer | null> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.get(url);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result as CachedModel | undefined;
        resolve(result ? result.data : null);
      };
    });
  } catch (error) {
    console.error('Error getting cached model:', error);
    return null;
  }
}

/**
 * Cache model data
 */
export async function cacheModel(url: string, data: ArrayBuffer): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const cachedModel: CachedModel = {
      url,
      data,
      timestamp: Date.now(),
      size: data.byteLength,
    };
    
    return new Promise((resolve, reject) => {
      const request = store.put(cachedModel);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Error caching model:', error);
    throw error;
  }
}

/**
 * Check if model is cached
 */
export async function isModelCached(url: string): Promise<boolean> {
  try {
    const data = await getCachedModel(url);
    return data !== null;
  } catch (error) {
    console.error('Error checking cache:', error);
    return false;
  }
}

/**
 * Get cache information for all cached models
 */
export async function getCacheInfo(): Promise<CacheInfo[]> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const results = request.result as CachedModel[];
        const info = results.map(model => ({
          url: model.url,
          timestamp: model.timestamp,
          size: model.size,
        }));
        resolve(info);
      };
    });
  } catch (error) {
    console.error('Error getting cache info:', error);
    return [];
  }
}

/**
 * Clear specific cached model
 */
export async function clearCachedModel(url: string): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.delete(url);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Error clearing cached model:', error);
    throw error;
  }
}

/**
 * Clear all cached models
 */
export async function clearAllCache(): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    throw error;
  }
}

/**
 * Get total cache size
 */
export async function getCacheSize(): Promise<number> {
  try {
    const cacheInfo = await getCacheInfo();
    return cacheInfo.reduce((total, info) => total + info.size, 0);
  } catch (error) {
    console.error('Error getting cache size:', error);
    return 0;
  }
}

/**
 * Format bytes for display
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Download model with caching
 */
export async function downloadAndCacheModel(url: string, onProgress?: (progress: number) => void): Promise<ArrayBuffer> {
  // Check if already cached
  const cachedData = await getCachedModel(url);
  if (cachedData) {
    console.log('Model loaded from cache:', url);
    return cachedData;
  }
  
  console.log('Downloading model:', url);
  
  // Download the model
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download model: ${response.status} ${response.statusText}`);
  }
  
  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  
  if (!response.body) {
    throw new Error('Response body is null');
  }
  
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  
  while (true) {
    const { done, value } = await reader.read();
    
    if (done) break;
    
    chunks.push(value);
    received += value.length;
    
    if (onProgress && total > 0) {
      onProgress((received / total) * 100);
    }
  }
  
  // Combine chunks into single ArrayBuffer
  const arrayBuffer = new ArrayBuffer(received);
  const view = new Uint8Array(arrayBuffer);
  let position = 0;
  
  for (const chunk of chunks) {
    view.set(chunk, position);
    position += chunk.length;
  }
  
  // Cache the model
  try {
    await cacheModel(url, arrayBuffer);
    console.log('Model cached successfully:', url);
  } catch (error) {
    console.warn('Failed to cache model, continuing without caching:', error);
  }
  
  return arrayBuffer;
}