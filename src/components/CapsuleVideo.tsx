import { useEffect, useRef, useState } from 'react';
import { CLIP_SECONDS } from '../types/capsule';

interface CapsuleVideoProps {
  blob: Blob;
  /** 원본 영상에서 재생을 시작할 위치(초) */
  start?: number;
  duration?: number;
  autoPlay?: boolean;
  className?: string;
}

/** 원본 영상의 [start, start + duration] 구간만 반복 재생하는 플레이어 */
export default function CapsuleVideo({ blob, start = 0, duration = CLIP_SECONDS, autoPlay = true, className = '' }: CapsuleVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const url = URL.createObjectURL(blob);
    el.src = url;
    return () => {
      el.pause();
      el.removeAttribute('src');
      el.load();
      URL.revokeObjectURL(url);
    };
  }, [blob]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const end = start + duration;
    let raf = 0;

    const clamp = () => {
      // loop 속성으로 0초로 돌아가거나 구간 끝을 넘으면 구간 시작으로 되돌린다
      if (el.currentTime >= end || el.currentTime < start - 0.25) el.currentTime = start;
      setProgress(Math.min(1, Math.max(0, (el.currentTime - start) / duration)));
    };
    // rAF는 부드러운 진행바용, timeupdate는 rAF가 멈추는 백그라운드 탭 대비
    const loop = () => {
      clamp();
      raf = requestAnimationFrame(loop);
    };
    const onPlay = () => {
      setPlaying(true);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    };
    const onPause = () => {
      setPlaying(false);
      cancelAnimationFrame(raf);
    };
    const onLoaded = () => {
      el.currentTime = start;
      if (autoPlay) el.play().catch(() => {});
    };

    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('loadedmetadata', onLoaded);
    el.addEventListener('timeupdate', clamp);
    // 이미 로드된 상태에서 구간(start)이 바뀐 경우
    if (el.readyState >= HTMLMediaElement.HAVE_METADATA) onLoaded();

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('loadedmetadata', onLoaded);
      el.removeEventListener('timeupdate', clamp);
    };
  }, [blob, start, duration, autoPlay]);

  useEffect(() => {
    if (ref.current) ref.current.muted = muted;
  }, [muted]);

  const togglePlay = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  };

  return (
    <div className={`relative overflow-hidden bg-black ${className}`}>
      <video ref={ref} muted playsInline loop className="w-full h-full object-contain" onClick={togglePlay} />

      {!playing && (
        <button onClick={togglePlay} className="absolute inset-0 flex items-center justify-center" type="button" aria-label="재생">
          <span className="w-14 h-14 rounded-full bg-black/45 backdrop-blur text-white flex items-center justify-center">
            <span className="material-symbols-outlined text-[34px]" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
          </span>
        </button>
      )}

      <button
        onClick={() => setMuted((m) => !m)}
        className="absolute top-2.5 right-2.5 w-9 h-9 rounded-full bg-black/45 backdrop-blur text-white flex items-center justify-center"
        type="button"
        aria-label={muted ? '소리 켜기' : '소리 끄기'}
      >
        <span className="material-symbols-outlined text-[20px]">{muted ? 'volume_off' : 'volume_up'}</span>
      </button>

      <div className="absolute bottom-0 inset-x-0 h-1 bg-white/25">
        <div className="h-full bg-primary-container" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}
