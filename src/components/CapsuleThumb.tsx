import { useEffect, useRef } from 'react';

interface CapsuleThumbProps {
  thumbnail: Blob | null;
  className?: string;
}

export default function CapsuleThumb({ thumbnail, className = '' }: CapsuleThumbProps) {
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !thumbnail) return;
    const url = URL.createObjectURL(thumbnail);
    el.src = url;
    return () => URL.revokeObjectURL(url);
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
