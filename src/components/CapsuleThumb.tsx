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
      <div className={`w-full h-full bg-gradient-to-br from-primary-fixed to-secondary-container flex items-center justify-center text-primary ${className}`}>
        <span className="material-symbols-outlined text-[40px] opacity-60">movie</span>
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
