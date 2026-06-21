export interface FrameExtractionProgress {
  current: number;
  total: number;
}

export function extractFramesFromVideo(
  file: File,
  fps: number = 2,
  onProgress?: (progress: FrameExtractionProgress) => void
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;
    video.muted = true;
    video.playsInline = true;
    
    // Ensure cross-origin loading if applicable (not strictly needed for local files, but good practice)
    video.crossOrigin = 'anonymous';

    video.onloadedmetadata = async () => {
      try {
        const duration = video.duration;
        if (isNaN(duration) || duration === Infinity) {
          reject(new Error("Invalid video duration."));
          return;
        }

        const totalFrames = Math.max(1, Math.floor(duration * fps));
        const frames: string[] = [];
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Could not get 2D context from canvas"));
          return;
        }
        
        // Downscale to 540p width to optimize network payload and Gemini token consumption
        const targetWidth = 540;
        canvas.width = targetWidth;
        canvas.height = (video.videoHeight / video.videoWidth) * targetWidth;
        
        // Setup tiny offscreen canvas for comparison (32x32) to filter out duplicate static frames
        const tinyCanvas = document.createElement('canvas');
        tinyCanvas.width = 32;
        tinyCanvas.height = 32;
        const tinyCtx = tinyCanvas.getContext('2d');
        let prevTinyData: Uint8ClampedArray | null = null;

        const interval = 1 / fps;
        let currentTime = 0;
        let frameCount = 0;
        
        while (currentTime < duration) {
          video.currentTime = currentTime;
          
          await new Promise<void>((resolveSeek) => {
            const onSeeked = () => {
              video.removeEventListener('seeked', onSeeked);
              resolveSeek();
            };
            video.addEventListener('seeked', onSeeked);
          });
          
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          let isSimilar = false;
          let currentTinyData: Uint8ClampedArray | null = null;

          if (tinyCtx) {
            tinyCtx.drawImage(video, 0, 0, 32, 32);
            currentTinyData = tinyCtx.getImageData(0, 0, 32, 32).data;

            if (prevTinyData) {
              let diffSum = 0;
              for (let i = 0; i < currentTinyData.length; i += 4) {
                diffSum += Math.abs(currentTinyData[i] - prevTinyData[i]);     // R
                diffSum += Math.abs(currentTinyData[i + 1] - prevTinyData[i + 1]); // G
                diffSum += Math.abs(currentTinyData[i + 2] - prevTinyData[i + 2]); // B
              }
              const maxDiff = 32 * 32 * 3 * 255;
              const averageDiff = diffSum / maxDiff;
              
              // If difference is less than 3.5%, we consider it a duplicate (similar)
              if (averageDiff < 0.035) {
                isSimilar = true;
              }
            }
          }

          if (!isSimilar) {
            const base64 = canvas.toDataURL('image/jpeg', 0.75).split(',')[1];
            frames.push(base64);
            if (currentTinyData) {
              prevTinyData = currentTinyData;
            }
          }
          
          frameCount++;
          if (onProgress) {
            onProgress({ current: frameCount, total: totalFrames });
          }
          
          currentTime += interval;
        }
        
        URL.revokeObjectURL(objectUrl);
        resolve(frames);
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };
    
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load video file. Make sure it is a valid MP4 video."));
    };
  });
}
