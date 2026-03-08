/**
 * Thumbnail Generation Worker
 * Uses OffscreenCanvas and createImageBitmap for high-performance,
 * background-thread image resizing.
 */

self.onmessage = async (e: MessageEvent) => {
  const { id, blob, width } = e.data;

  try {
    // 1. Create a bitmap from the blob (native browser decoding)
    // We resize it DURING the decode step for maximum efficiency
    const bitmap = await createImageBitmap(blob, {
      resizeWidth: width,
      resizeQuality: 'medium'
    });

    // 2. Use OffscreenCanvas to draw the resized bitmap
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Could not get OffscreenCanvas context');
    }

    ctx.drawImage(bitmap, 0, 0);
    
    // 3. Convert to a small JPEG blob
    const thumbnailBlob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality: 0.7
    });

    // 4. Release bitmap memory
    bitmap.close();

    // 5. Send result back
    self.postMessage({ id, blob: thumbnailBlob });
  } catch (err: any) {
    self.postMessage({ id, error: err.message });
  }
};
