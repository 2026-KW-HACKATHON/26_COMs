import { useEffect, useRef, useState } from 'react';
import type { Capsule } from '../types/capsule';
import CapsuleThumb from './CapsuleThumb';
import CapsuleVideo from './CapsuleVideo';

/**
 * 피드 안의 영상: 화면에 절반 넘게 보이면 그때 영상을 불러와 자동 재생하고, 벗어나면 멈춘다.
 * (앨범 영상은 원본이 수십 MB라 목록 전체를 한꺼번에 불러오지 않는다. 한 번 불러온 영상은 다시 붙였다 떼지 않는다:
 *  같은 파일을 다시 연결하면 브라우저가 불러오다 멈추는 경우가 있다)
 */
export default function FeedVideo({ capsule, onLike, className = '' }: { capsule: Capsule; onLike?: () => void; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.intersectionRatio >= 0.55;
        setActive(visible);
        if (visible) setLoaded(true);
      },
      { threshold: [0, 0.55, 1] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`relative overflow-hidden bg-surface-container ${className}`}>
      {loaded ? (
        <div className="absolute inset-0">
          <CapsuleVideo
            src={capsule.video}
            start={capsule.clipStart}
            duration={capsule.clipDuration}
            autoPlay={active}
            cover
            onLike={onLike}
            className="w-full h-full"
          />
        </div>
      ) : (
        <>
          <CapsuleThumb thumbnail={capsule.thumbnail} />
          <span className="absolute inset-0 flex items-center justify-center bg-black/10 text-white">
            <span className="material-symbols-rounded icon-fill text-[40px] drop-shadow">play_arrow</span>
          </span>
        </>
      )}
    </div>
  );
}
