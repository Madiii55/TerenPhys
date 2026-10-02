/**
 * Utility to crop and compress user-uploaded avatar images
 * before sending to Firestore to stay far below the 1MB document limit.
 */
export async function compressAvatarImage(
  file: File,
  targetSize = 256,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      return reject(new Error('Пожалуйста, выберите файл изображения (PNG, JPG, WebP и т.д.).'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Не удалось прочитать файл изображения.'));

    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Недопустимый или повреждённый формат изображения.'));

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const width = img.naturalWidth || img.width;
          const height = img.naturalHeight || img.height;

          if (width === 0 || height === 0) {
            return reject(new Error('Изображение имеет нулевой размер.'));
          }

          // Center crop to 1:1 square
          const minDim = Math.min(width, height);
          const startX = (width - minDim) / 2;
          const startY = (height - minDim) / 2;

          const size = Math.min(minDim, targetSize);
          canvas.width = size;
          canvas.height = size;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return reject(new Error('Не удалось инициализировать canvas.'));
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Draw centered square crop
          ctx.drawImage(
            img,
            startX,
            startY,
            minDim,
            minDim,
            0,
            0,
            size,
            size
          );

          // Convert to compressed JPEG data URL (~15-30 KB)
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        } catch (err) {
          reject(err);
        }
      };

      img.src = reader.result as string;
    };

    reader.readAsDataURL(file);
  });
}
