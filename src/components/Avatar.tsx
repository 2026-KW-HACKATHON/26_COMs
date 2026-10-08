import { useState } from 'react';
import type { Profile } from '../types/social';

interface AvatarProps {
  profile: Pick<Profile, 'displayName' | 'avatarUrl'> | null;
  size?: number;
  className?: string;
}

/** 프로필 사진. 사진이 없거나 못 불러오면 이름 첫 글자 */
export default function Avatar({ profile, size = 36, className = '' }: AvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = profile?.avatarUrl;
  const style = { width: size, height: size };

  if (url && url !== failedUrl) {
    return (
      <img
        src={url}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailedUrl(url)}
        style={style}
        className={`shrink-0 rounded-full object-cover bg-gray-100 border border-gray-100 ${className}`}
      />
    );
  }

  return (
    <span
      style={{ ...style, fontSize: Math.round(size * 0.42) }}
      className={`shrink-0 rounded-full brand-gradient font-bold flex items-center justify-center ${className}`}
    >
      {profile?.displayName.trim().charAt(0) || '?'}
    </span>
  );
}
