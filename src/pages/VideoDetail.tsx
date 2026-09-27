import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CapsuleVideo from '../components/CapsuleVideo';
import { getPlace, placeSubtitle } from '../data/places';
import { deleteCapsule, getCapsule } from '../lib/capsuleStore';
import { formatDate } from '../lib/format';
import type { Capsule } from '../types/capsule';

export default function VideoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  // undefined: 불러오는 중, null: 없음
  const [capsule, setCapsule] = useState<Capsule | null | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    getCapsule(id)
      .then((c) => alive && setCapsule(c ?? null))
      .catch(() => alive && setCapsule(null));
    return () => {
      alive = false;
    };
  }, [id]);

  if (capsule === undefined) return null;
  if (capsule === null) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-[60vh] text-on-surface-variant">
        <span className="material-symbols-outlined text-[48px] mb-4 opacity-50">search_off</span>
        <p className="font-body-md text-body-md">영상을 찾을 수 없어요.</p>
      </div>
    );
  }

  const place = getPlace(capsule.placeId);

  const handleDelete = async () => {
    if (!confirm('이 영상을 삭제할까요? 되돌릴 수 없어요.')) return;
    await deleteCapsule(capsule.id);
    navigate('/log', { replace: true });
  };

  return (
    <div className="flex flex-col w-full pb-6 pt-3 gap-4">
      <CapsuleVideo
        blob={capsule.video}
        start={capsule.clipStart}
        duration={capsule.clipDuration}
        className="w-full aspect-[3/4] rounded-2xl shadow-sm"
      />

      <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-1">
        <h2 className="font-headline-md text-headline-md text-on-surface">{capsule.placeName}</h2>
        {place && (
          <p className="font-label-md text-label-md text-on-surface-variant">
            {[placeSubtitle(place), place.address].filter(Boolean).join(' · ')}
          </p>
        )}
        <p className="font-label-md text-label-md text-on-surface-variant flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px]">event</span>
          {formatDate(capsule.createdAt)}에 남김
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={() => navigate('/', { state: { placeId: capsule.placeId } })}
          className="h-12 rounded-xl bg-surface-container-low text-on-surface font-label-lg text-label-lg flex items-center justify-center gap-1.5 hover:bg-surface-container"
          type="button"
        >
          <span className="material-symbols-outlined text-[20px] text-primary">map</span> 지도에서 보기
        </button>
        <button
          onClick={handleDelete}
          className="h-12 rounded-xl bg-surface-container-low text-error font-label-lg text-label-lg flex items-center justify-center gap-1.5 hover:bg-error-container"
          type="button"
        >
          <span className="material-symbols-outlined text-[20px]">delete</span> 삭제
        </button>
      </div>
    </div>
  );
}
