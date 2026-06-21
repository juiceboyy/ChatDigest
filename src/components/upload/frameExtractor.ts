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
          const base64 = canvas.toDataURL('image/jpeg', 0.75).split(',')[1];
          frames.push(base64);
          
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
