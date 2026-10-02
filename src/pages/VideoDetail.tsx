import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Avatar from '../components/Avatar';
import CapsuleVideo from '../components/CapsuleVideo';
import { getPlace, placeSubtitle } from '../data/places';
import { useAuth } from '../hooks/useAuth';
import { SOCIAL_ENABLED, deleteCapsule, getCapsule } from '../lib/capsuleStore';
import { formatDate } from '../lib/format';
import { removeMyTag } from '../lib/social';
import type { Capsule } from '../types/capsule';

export default function VideoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const me = useAuth().session?.user.id ?? '';
  // undefined: 불러오는 중, null: 없음
  const [capsule, setCapsule] = useState<Capsule | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

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
      <div className="flex flex-col items-center justify-center w-full h-[60vh] text-on-surface-variant text-center px-6">
        <span className="material-symbols-outlined text-[48px] mb-4 opacity-50">search_off</span>
        <p className="font-body-md text-body-md">영상을 찾을 수 없어요.</p>
        {SOCIAL_ENABLED && <p className="mt-1 font-label-md text-label-md">친구의 영상이나 나를 태그한 영상만 볼 수 있어요.</p>}
      </div>
    );
  }

  const place = getPlace(capsule.placeId);
  const isMine = !SOCIAL_ENABLED || capsule.userId === me;
  const taggedMe = SOCIAL_ENABLED && capsule.tags.some((t) => t.id === me);
  // 내 영상이거나 내가 태그된 영상은 내 지도에, 친구 영상은 친구 지도에 있다
  const mapPath = isMine || taggedMe ? '/' : `/?user=${capsule.userId}`;

  const handleDelete = async () => {
    if (!confirm('이 영상을 삭제할까요? 되돌릴 수 없어요.')) return;
    setBusy(true);
    try {
      await deleteCapsule(capsule.id);
      navigate('/log', { replace: true });
    } catch (err) {
      console.error(err);
      alert('영상을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.');
      setBusy(false);
    }
  };

  const handleUntag = async () => {
    if (!confirm('이 영상에서 내 태그를 뺄까요? 친구가 아니면 영상을 더 이상 볼 수 없어요.')) return;
    setBusy(true);
    try {
      await removeMyTag(capsule.id, me);
      navigate('/log', { replace: true });
    } catch (err) {
      console.error(err);
      alert('태그를 빼지 못했어요. 잠시 후 다시 시도해 주세요.');
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col w-full pb-6 pt-3 gap-4">
      {SOCIAL_ENABLED && capsule.author && (
        <div className="flex items-center gap-2.5">
          <Avatar profile={capsule.author} size={36} />
          <div className="min-w-0">
            <p className="font-label-lg text-label-lg text-on-surface font-bold truncate">{isMine ? '내가 남긴 영상' : capsule.author.displayName}</p>
            <p className="font-label-sm text-label-sm text-on-surface-variant truncate">@{capsule.author.username}</p>
          </div>
        </div>
      )}

      <CapsuleVideo
        src={capsule.video}
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
        {capsule.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant">group</span>
            {capsule.tags.map((t) => (
              <span key={t.id} className="h-7 pl-0.5 pr-2 rounded-full bg-primary-fixed/60 text-on-primary-fixed font-label-sm text-label-sm flex items-center gap-1">
                <Avatar profile={t} size={24} />
                <span className="font-bold">@{t.username}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={() => navigate(mapPath, { state: { placeId: capsule.placeId } })}
          className="h-12 rounded-xl bg-surface-container-low text-on-surface font-label-lg text-label-lg flex items-center justify-center gap-1.5 hover:bg-surface-container"
          type="button"
        >
          <span className="material-symbols-outlined text-[20px] text-primary">map</span> 지도에서 보기
        </button>
        {isMine ? (
          <button
            onClick={handleDelete}
            disabled={busy}
            className="h-12 rounded-xl bg-surface-container-low text-error font-label-lg text-label-lg flex items-center justify-center gap-1.5 hover:bg-error-container disabled:opacity-50"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">delete</span> 삭제
          </button>
        ) : taggedMe ? (
          <button
            onClick={handleUntag}
            disabled={busy}
            className="h-12 rounded-xl bg-surface-container-low text-on-surface-variant font-label-lg text-label-lg flex items-center justify-center gap-1.5 hover:bg-surface-container disabled:opacity-50"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">label_off</span> 내 태그 빼기
          </button>
        ) : null}
      </div>
    </div>
  );
}
