// MediaRecorder가 지원하는 포맷 중 가장 호환성 좋은 것을 고른다 (iOS Safari는 mp4, Chrome은 webm).
export function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ].find((type) => MediaRecorder.isTypeSupported(type));
}

function waitFor(el: HTMLMediaElement, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      el.removeEventListener(event, onOk);
      el.removeEventListener('error', onError);
    };
    const onOk = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('video load failed'));
    };
    el.addEventListener(event, onOk);
    el.addEventListener('error', onError);
  });
}

async function withVideo<T>(blob: Blob, fn: (el: HTMLVideoElement) => Promise<T>): Promise<T> {
  const el = document.createElement('video');
  el.muted = true;
  el.playsInline = true;
  el.preload = 'auto';
  const url = URL.createObjectURL(blob);
  try {
    const loaded = waitFor(el, 'loadedmetadata');
    el.src = url;
    await loaded;
    return await fn(el);
  } finally {
    el.removeAttribute('src');
    el.load();
    URL.revokeObjectURL(url);
  }
}

async function seek(el: HTMLVideoElement, time: number) {
  const seeked = waitFor(el, 'seeked');
  el.currentTime = time;
  await seeked;
}

/** 영상 길이(초). 재생 불가능한 형식이면 reject. */
export function probeDuration(blob: Blob): Promise<number> {
  return withVideo(blob, async (el) => {
    if (!Number.isFinite(el.duration)) {
      // MediaRecorder로 만든 WebM은 끝까지 seek하기 전까지 duration이 Infinity로 나온다
      await seek(el, Number.MAX_SAFE_INTEGER);
    }
    return Number.isFinite(el.duration) ? el.duration : 0;
  });
}

export function captureFrame(el: HTMLVideoElement, maxWidth = 720): Promise<Blob> {
  if (!el.videoWidth) return Promise.reject(new Error('no video frame'));
  const scale = Math.min(1, maxWidth / el.videoWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(el.videoWidth * scale);
  canvas.height = Math.round(el.videoHeight * scale);
  canvas.getContext('2d')!.drawImage(el, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.8),
  );
}

export function thumbnailAt(blob: Blob, time: number): Promise<Blob> {
  return withVideo(blob, async (el) => {
    await seek(el, Math.max(0.1, time));
    return captureFrame(el);
  });
}
