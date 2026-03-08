import { useState, useCallback, useRef, useEffect } from 'react';
import * as idb from 'idb-keyval';

interface ThumbnailRequest {
  id: string;
  url: string;
  blob?: Blob;
}

const THUMBNAIL_WIDTH = 400;

export const useThumbnailQueue = () => {
  const [cacheHits, setCacheHits] = useState<Map<string, string>>(new Map());
  const queueRef = useRef<ThumbnailRequest[]>([]);
  const isProcessingRef = useRef(false);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Initialize worker with relative URL (vite will handle this)
    workerRef.current = new Worker(new URL('../lib/thumbnail-worker.ts', import.meta.url), {
      type: 'module'
    });

    workerRef.current.onmessage = async (e) => {
      const { id, blob, error } = e.data;
      
      if (!error && blob) {
        const url = URL.createObjectURL(blob);
        setCacheHits(prev => new Map(prev).set(id, url));
        
        // Persist to IndexedDB (as dataURL for simple retrieval or keep as Blob)
        try {
          await idb.set(`thumb_${id}`, blob);
        } catch (err) {}
      }

      // Process next in queue
      isProcessingRef.current = false;
      processNext();
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const processNext = useCallback(async () => {
    if (isProcessingRef.current || queueRef.current.length === 0 || !workerRef.current) return;

    isProcessingRef.current = true;
    const request = queueRef.current.shift()!;

    try {
      // 1. Double check cache before expensive work
      const cached = await idb.get(`thumb_${request.id}`);
      if (cached instanceof Blob) {
        const url = URL.createObjectURL(cached);
        setCacheHits(prev => new Map(prev).set(request.id, url));
        isProcessingRef.current = false;
        processNext();
        return;
      }

      // 2. Fetch original if no blob provided
      let blob = request.blob;
      if (!blob) {
        const res = await fetch(request.url);
        blob = await res.blob();
      }

      // 3. Send to worker
      workerRef.current.postMessage({
        id: request.id,
        blob,
        width: THUMBNAIL_WIDTH
      });
    } catch (err) {
      console.error('[ThumbnailQueue] Failed to process:', request.id, err);
      isProcessingRef.current = false;
      processNext();
    }
  }, []);

  const requestThumbnail = useCallback(async (id: string, url: string, blob?: Blob) => {
    // 1. Sync check state
    if (cacheHits.has(id)) return;

    // 2. Async check idb
    const cached = await idb.get(`thumb_${id}`);
    if (cached instanceof Blob) {
      setCacheHits(prev => new Map(prev).set(id, URL.createObjectURL(cached)));
      return;
    }

    // 3. Add to queue if not already there
    if (!queueRef.current.some(r => r.id === id)) {
      queueRef.current.push({ id, url, blob });
      processNext();
    }
  }, [cacheHits, processNext]);

  return {
    cacheHits,
    requestThumbnail
  };
};
