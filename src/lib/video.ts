import type { Media } from '../types/capsule';

/** <img>·<video>에 파일(Blob) 또는 URL을 연결하고, 연결을 풀 때 부를 함수를 돌려준다. */
export function attachSrc(el: HTMLImageElement | HTMLVideoElement, media: Media): () => void {
  if (typeof media === 'string') {
    el.src = media;
    return () => {};
  }
  const url = URL.createObjectURL(media);
  el.src = url;
  return () => URL.revokeObjectURL(url);
}

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

/** 다시 녹화할 때 긴 변의 최대 픽셀 (세로 영상이면 720×1280) */
const TRIM_MAX_SIDE = 1280;
const TRIM_BITRATE = 2_500_000;

/**
 * 앨범 영상에서 고른 구간만 다시 녹화한 새 파일 (5초 ≈ 2MB). 원본(최대 50MB)을 통째로 올리지 않으려고 쓴다.
 * 구간을 실제 속도로 재생하면서 캔버스에 그려 녹화하므로 구간 길이만큼 걸린다. 소리는 Web Audio로 함께 담는다.
 * 버튼을 누른 그 순간(await 전)에 불러야 한다: iPhone은 소리 있는 재생과 오디오를 사용자 동작 안에서만 시작할 수 있다.
 * 지원하지 않는 브라우저이거나 실패하면 reject하고, 그러면 원본을 그대로 올린다.
 */
export function trimClip(blob: Blob, start: number, duration: number): Promise<Blob> {
  const mimeType = pickRecorderMimeType();
  if (!mimeType || typeof HTMLCanvasElement.prototype.captureStream !== 'function') {
    return Promise.reject(new Error('trim unsupported'));
  }

  // 여기부터 첫 await 전까지는 사용자 동작 안에서 실행된다
  const el = document.createElement('video');
  el.playsInline = true;
  el.preload = 'auto';
  const url = URL.createObjectURL(blob);
  el.src = url;
  let audio: AudioContext | null = null;
  let audioDest: MediaStreamAudioDestinationNode | null = null;
  try {
    audio = new AudioContext();
    audioDest = audio.createMediaStreamDestination();
    // 스피커(audio.destination)에는 잇지 않아서 녹화하는 동안 소리가 들리지 않는다
    audio.createMediaElementSource(el).connect(audioDest);
    void audio.resume();
  } catch {
    audio = null;
    audioDest = null;
    el.muted = true;
  }
  const unlocked = el.play().then(() => el.pause());

  const run = async () => {
    await unlocked;
    if (el.readyState < HTMLMediaElement.HAVE_METADATA) await waitFor(el, 'loadedmetadata');
    await seek(el, start);

    const scale = Math.min(1, TRIM_MAX_SIDE / Math.max(el.videoWidth, el.videoHeight));
    const canvas = document.createElement('canvas');
    // 인코더는 짝수 크기를 좋아한다
    canvas.width = Math.round((el.videoWidth * scale) / 2) * 2;
    canvas.height = Math.round((el.videoHeight * scale) / 2) * 2;
    const g = canvas.getContext('2d')!;
    const paint = () => g.drawImage(el, 0, 0, canvas.width, canvas.height);
    paint();

    const stream = canvas.captureStream(30);
    audioDest?.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: TRIM_BITRATE });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const stopped = new Promise((resolve) => (recorder.onstop = resolve));

    const end = start + duration;
    let timer = 0;
    const done = new Promise<void>((resolve) => {
      const check = () => {
        if (el.currentTime >= end || el.ended) resolve();
      };
      // requestAnimationFrame은 화면이 가려지면 멈춰서 타이머로 그린다 (가려져도 느리게나마 계속 진행)
      el.addEventListener(
        'playing',
        () => {
          if (recorder.state === 'inactive') recorder.start(250);
          timer = window.setInterval(() => {
            paint();
            check();
          }, 1000 / 30);
        },
        { once: true },
      );
      el.addEventListener('timeupdate', check);
      el.addEventListener('ended', () => resolve(), { once: true });
      // 어떤 이유로 멈춰도 끝나도록
      setTimeout(resolve, duration * 1000 + 8000);
      el.play().catch(() => resolve());
    });
    await done;
    clearInterval(timer);
    el.pause();
    recorder.stop();
    await stopped;
    stream.getTracks().forEach((t) => t.stop());

    const out = new Blob(chunks, { type: mimeType.split(';')[0] });
    if (out.size < 1024) throw new Error('trim produced an empty clip');
    return out;
  };

  return run().finally(() => {
    el.pause();
    el.removeAttribute('src');
    el.load();
    URL.revokeObjectURL(url);
    void audio?.close();
  });
}
