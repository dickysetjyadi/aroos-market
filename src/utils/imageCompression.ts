export interface ImageCompressionOptions {
  maxDimension?: number;
  quality?: number;
  maxDataUrlLength?: number;
}

function drawToCanvas(
  source: CanvasImageSource,
  srcWidth: number,
  srcHeight: number,
  maxDimension: number,
  quality: number
): string {
  const safeW = Math.max(1, srcWidth);
  const safeH = Math.max(1, srcHeight);
  const ratio = Math.min(1, maxDimension / Math.max(safeW, safeH));
  const targetWidth = Math.max(1, Math.round(safeW * ratio));
  const targetHeight = Math.max(1, Math.round(safeH * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Browser gagal memproses gambar.');
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(source, 0, 0, targetWidth, targetHeight);
  return canvas.toDataURL('image/jpeg', quality);
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        resolve(img);
      } else {
        reject(new Error('Dimensi gambar tidak valid.'));
      }
    };
    img.onerror = () => reject(new Error('Format gambar tidak didukung browser ini.'));
    img.src = src;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result) {
        resolve(reader.result);
      } else {
        reject(new Error('Gagal membaca file gambar.'));
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.readAsDataURL(file);
  });
}

async function decodeImageFile(file: File): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}> {
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await loadImageElement(objectUrl);
      return {
        source: img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        cleanup: () => URL.revokeObjectURL(objectUrl),
      };
    } catch {
      URL.revokeObjectURL(objectUrl);
    }
  }

  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => {
          try {
            bitmap.close();
          } catch {}
        },
      };
    } catch {
      // fallback to FileReader
    }
  }

  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImageElement(dataUrl);
  return {
    source: img,
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
    cleanup: () => {},
  };
}

/**
 * Compresses camera / gallery photos (including high-res iPhone camera captures)
 * into a lightweight JPEG data URL safely under Firestore document byte limits.
 */
export async function compressImageForUpload(
  file: File,
  options?: ImageCompressionOptions
): Promise<string> {
  const initialDim = options?.maxDimension ?? 900;
  const initialQuality = options?.quality ?? 0.78;
  const maxDataUrlLength = options?.maxDataUrlLength ?? 480_000;

  const decoded = await decodeImageFile(file);
  try {
    const passes: Array<[number, number]> = [
      [initialDim, initialQuality],
      [Math.min(initialDim, 740), Math.min(initialQuality, 0.68)],
      [Math.min(initialDim, 580), Math.min(initialQuality, 0.56)],
      [Math.min(initialDim, 440), Math.min(initialQuality, 0.46)],
    ];

    let result = '';
    for (const [dim, q] of passes) {
      result = drawToCanvas(decoded.source, decoded.width, decoded.height, dim, q);
      if (result.length <= maxDataUrlLength) {
        return result;
      }
    }

    if (result.length <= maxDataUrlLength) {
      return result;
    }

    throw new Error(
      'Ukuran foto masih terlalu besar setelah kompresi. Gunakan foto lain yang lebih ringan.'
    );
  } finally {
    decoded.cleanup();
  }
}
