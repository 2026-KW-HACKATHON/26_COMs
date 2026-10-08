import { useEffect, useRef, useState } from 'react';
import { attachSrc } from '../lib/video';
import { CLIP_SECONDS, type Media } from '../types/capsule';

/** 이 안에 다시 톡 치면 두 번 톡(하트)으로 본다 */
const DOUBLE_TAP_MS = 300;

interface CapsuleVideoProps {
  /** 영상 파일 또는 서버 URL */
  src: Media;
  /** 원본 영상에서 재생을 시작할 위치(초) */
  start?: number;
  duration?: number;
  /** 불러오면 바로 재생. 재생 중에 false로 바뀌면 멈춘다 (피드에서 화면 밖으로 나갈 때) */
  autoPlay?: boolean;
  /** 틀을 꽉 채우도록 잘라서 보여 준다 (피드). 기본은 영상 전체가 보이게 */
  cover?: boolean;
  /** 영상을 두 번 톡 치면 가운데 큰 하트가 떴다 사라지고 불린다 (주면 한 번 톡의 재생·멈춤은 두 번 톡이 아닌지 보고 나서) */
  onLike?: () => void;
  className?: string;
}

/** 원본 영상의 [start, start + duration] 구간만 반복 재생하는 플레이어 */
export default function CapsuleVideo({ src, start = 0, duration = CLIP_SECONDS, autoPlay = true, cover = false, onLike, className = '' }: CapsuleVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  // 두 번 톡: 마지막 톡 시각과 미뤄 둔 재생·멈춤. burst는 큰 하트 애니메이션을 다시 재생하는 키
  const tap = useRef({ at: 0, timer: 0 });
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const detach = attachSrc(el, src);
    return () => {
      el.pause();
      el.removeAttribute('src');
      el.load();
      detach();
    };
  }, [src]);

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
    // 이미 로드된 상태에서 구간(start)이나 autoPlay가 바뀐 경우
    if (!autoPlay) el.pause();
    else if (el.readyState >= HTMLMediaElement.HAVE_METADATA) onLoaded();

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('loadedmetadata', onLoaded);
      el.removeEventListener('timeupdate', clamp);
    };
  }, [src, start, duration, autoPlay]);

  useEffect(() => {
    if (ref.current) ref.current.muted = muted;
  }, [muted]);

  useEffect(() => {
    const t = tap.current;
    return () => clearTimeout(t.timer);
  }, []);

  const togglePlay = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  };

  const handleTap = () => {
    if (!onLike) return togglePlay();
    const t = tap.current;
    if (Date.now() - t.at < DOUBLE_TAP_MS) {
      clearTimeout(t.timer);
      t.at = 0;
      setBurst((n) => n + 1);
      onLike();
      return;
    }
    t.at = Date.now();
    t.timer = window.setTimeout(togglePlay, DOUBLE_TAP_MS);
  };

  return (
    // touch-manipulation: 두 번 톡이 화면 확대로 먹히지 않게
    <div className={`relative overflow-hidden bg-black touch-manipulation ${className}`}>
      <video ref={ref} muted playsInline loop className={`w-full h-full ${cover ? 'object-cover' : 'object-contain'}`} onClick={handleTap} />

      {!playing && (
        <button onClick={handleTap} className="absolute inset-0 flex items-center justify-center" type="button" aria-label="재생">
          <span className="w-14 h-14 rounded-full bg-white text-gray-800 flex items-center justify-center">
            <span className="material-symbols-rounded text-[34px] icon-fill">play_arrow</span>
          </span>
        </button>
      )}

      <button
        onClick={() => setMuted((m) => !m)}
        className="absolute top-2.5 right-2.5 w-9 h-9 rounded-full bg-white text-gray-800 flex items-center justify-center"
        type="button"
        aria-label={muted ? '소리 켜기' : '소리 끄기'}
      >
        <span className="material-symbols-rounded text-[20px]">{muted ? 'volume_off' : 'volume_up'}</span>
      </button>

      <div className="absolute bottom-0 inset-x-0 h-1 bg-white/25">
        <div className="h-full bg-primary" style={{ width: `${progress * 100}%` }} />
      </div>

      {burst > 0 && (
        <span key={burst} className="like-burst absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden>
          <span className="material-symbols-rounded icon-fill text-[96px] text-white drop-shadow-lg">favorite</span>
        </span>
      )}
    </div>
  );
}
