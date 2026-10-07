import { useEffect, useRef } from 'react';
import { attachSrc } from '../lib/video';
import type { Media } from '../types/capsule';

interface CapsuleThumbProps {
  thumbnail: Media | null;
  className?: string;
}

export default function CapsuleThumb({ thumbnail, className = '' }: CapsuleThumbProps) {
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !thumbnail) return;
    return attachSrc(el, thumbnail);
  }, [thumbnail]);

  if (!thumbnail) {
    return (
      <div className={`w-full h-full bg-surface-container flex items-center justify-center text-gray-400 ${className}`}>
        <span className="material-symbols-rounded text-[36px]">movie</span>
      </div>
    );
  }

  return (
    <img
      ref={ref}
      alt=""
      className={`w-full h-full object-cover ${className}`}
    />
  );
}
