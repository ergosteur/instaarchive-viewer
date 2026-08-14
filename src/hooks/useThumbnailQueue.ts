import { useState, useCallback, useRef, useEffect } from 'react';
import * as idb from 'idb-keyval';
import { thumbKey } from '../lib/archive-cache';

interface ThumbnailRequest {
  id: string;
  key: string;
  url: string;
  blob?: Blob;
}

const THUMBNAIL_WIDTH = 400;

export const useThumbnailQueue = (archiveName: string) => {
  const [cacheHits, setCacheHits] = useState<Map<string, string>>(new Map());
  const queueRef = useRef<ThumbnailRequest[]>([]);
  const isProcessingRef = useRef(false);
  const workerRef = useRef<Worker | null>(null);

  /**
   * Mirrors `cacheHits` for reads inside callbacks.
   *
   * `requestThumbnail` is a dependency of every PostThumbnail effect, so it must
   * keep a stable identity — closing over `cacheHits` state directly would give
   * it a new identity per completed thumbnail and re-run the effect in all
   * ~90 mounted thumbnails each time.
   */
  const cacheHitsRef = useRef<Map<string, string>>(new Map());
  /** Blob URLs handed out for thumbnails, released when the archive changes. */
  const createdUrlsRef = useRef<string[]>([]);

  const publish = useCallback((id: string, url: string) => {
    createdUrlsRef.current.push(url);
    cacheHitsRef.current.set(id, url);
    setCacheHits(new Map(cacheHitsRef.current));
  }, []);

  const processNext = useCallback(async () => {
    if (isProcessingRef.current || queueRef.current.length === 0 || !workerRef.current) return;

    isProcessingRef.current = true;
    const request = queueRef.current.shift()!;

    try {
      // Re-check the store: the entry may have landed since being queued.
      const cached = await idb.get(request.key);
      if (cached instanceof Blob) {
        publish(request.id, URL.createObjectURL(cached));
        isProcessingRef.current = false;
        processNext();
        return;
      }

      let blob = request.blob;
      if (!blob) {
        const res = await fetch(request.url);
        blob = await res.blob();
      }

      // One image at a time: decoding several 50MP+ files concurrently is a
      // reliable way to OOM the tab.
      workerRef.current.postMessage({ id: request.key, blob, width: THUMBNAIL_WIDTH });
    } catch (err) {
      console.error('[ThumbnailQueue] Failed to process:', request.id, err);
      isProcessingRef.current = false;
      processNext();
    }
  }, [publish]);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../lib/thumbnail-worker.ts', import.meta.url), {
      type: 'module'
    });

    workerRef.current.onmessage = async (e) => {
      const { id: key, blob, error } = e.data;

      if (!error && blob) {
        const id = key.split(':').slice(2).join(':');
        publish(id, URL.createObjectURL(blob));
        try {
          await idb.set(key, blob);
        } catch (err) { /* quota exceeded; the in-memory hit still stands */ }
      }

      isProcessingRef.current = false;
      processNext();
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, [publish, processNext]);

  // Switching archives invalidates every thumbnail URL handed out so far.
  useEffect(() => {
    return () => {
      queueRef.current = [];
      for (const url of createdUrlsRef.current) {
        try { URL.revokeObjectURL(url); } catch { /* already gone */ }
      }
      createdUrlsRef.current = [];
      cacheHitsRef.current = new Map();
      setCacheHits(new Map());
    };
  }, [archiveName]);

  const requestThumbnail = useCallback(async (id: string, url: string, blob?: Blob) => {
    if (cacheHitsRef.current.has(id)) return;

    const key = thumbKey(archiveName, id);
    const cached = await idb.get(key);
    if (cached instanceof Blob) {
      publish(id, URL.createObjectURL(cached));
      return;
    }

    if (!queueRef.current.some(r => r.id === id)) {
      queueRef.current.push({ id, key, url, blob });
      processNext();
    }
  }, [archiveName, publish, processNext]);

  return {
    cacheHits,
    requestThumbnail
  };
};
