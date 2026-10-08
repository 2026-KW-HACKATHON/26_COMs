import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Avatar from '../components/Avatar';
import CapsuleVideo from '../components/CapsuleVideo';
import LikeButton from '../components/LikeButton';
import NudgeButton from '../components/NudgeButton';
import { getPlace, placeSubtitle } from '../data/places';
import { useAuth } from '../hooks/useAuth';
import { useFriendships } from '../hooks/useFriendships';
import { useLike } from '../hooks/useLike';
import { SOCIAL_ENABLED, deleteCapsule, getCapsule, setVisibility } from '../lib/capsuleStore';
import { formatDate } from '../lib/format';
import { removeMyTag } from '../lib/social';
import type { Capsule } from '../types/capsule';
import type { Profile } from '../types/social';

export default function VideoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const me = useAuth().session?.user.id ?? '';
  const { list: friendships } = useFriendships();
  // undefined: 불러오는 중, null: 없음
  const [capsule, setCapsule] = useState<Capsule | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const like = useLike(capsule);

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
        <span className="material-symbols-rounded text-[48px] mb-4 text-gray-300">search_off</span>
        <p className="text-body-md">영상을 찾을 수 없어요.</p>
        {SOCIAL_ENABLED && <p className="mt-1 text-label-md">친구의 영상, 나를 태그한 영상, 동네에 공개된 영상만 볼 수 있어요.</p>}
      </div>
    );
  }

  const place = getPlace(capsule.placeId);
  const isMine = !SOCIAL_ENABLED || capsule.userId === me;
  const taggedMe = SOCIAL_ENABLED && capsule.tags.some((t) => t.id === me);
  const friendIds = new Set(friendships?.filter((f) => f.status === 'friend').map((f) => f.id));
  // 내 영상이거나 내가 태그된 영상은 내 지도에, 친구 영상은 친구 지도에, 모르는 사람의 동네 공개 영상은 동네 지도에 있다
  const mapPath = isMine || taggedMe ? '/' : friendIds.has(capsule.userId) ? `/?user=${capsule.userId}` : '/?view=town';
  // 같이 간 친구: 내가 이 영상에 나올 때(작성자·태그), 함께 나온 사람 중 지금 친구인 사람
  const companions =
    SOCIAL_ENABLED && (isMine || taggedMe)
      ? [capsule.author, ...capsule.tags].filter((p): p is Profile => !!p && p.id !== me && friendIds.has(p.id))
      : [];

  const toggleVisibility = async () => {
    const next = capsule.visibility === 'town' ? 'friends' : 'town';
    setBusy(true);
    try {
      await setVisibility(capsule.id, next);
      setCapsule({ ...capsule, visibility: next });
    } catch (err) {
      console.error(err);
      alert('공개 범위를 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

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
    <div className="flex flex-col w-full pb-8 pt-3 gap-4">
      {SOCIAL_ENABLED && capsule.author && (
        <div className="flex items-center gap-2.5 app-card p-3.5 rounded-xl">
          <Avatar profile={capsule.author} size={36} />
          <div className="min-w-0">
            <p className="text-label-lg text-on-surface font-bold truncate">{isMine ? '내가 남긴 영상' : capsule.author.displayName}</p>
            <p className="text-label-sm text-on-surface-variant truncate">
              @{capsule.author.username}
              {capsule.visibility === 'town' && ' · 동네 공개'}
            </p>
          </div>
        </div>
      )}

      <CapsuleVideo
        src={capsule.video}
        start={capsule.clipStart}
        duration={capsule.clipDuration}
        onLike={like.like}
        className="w-full aspect-[3/4] rounded-xl"
      />

      <div className="flex items-center -my-2.5">
        <LikeButton like={like} />
      </div>

      <div className="flex flex-col gap-1 px-0.5">
        <h2 className="text-headline-md text-on-surface">{capsule.placeName}</h2>
        {place && (
          <p className="text-label-md text-on-surface-variant">
            {[placeSubtitle(place), place.address].filter(Boolean).join(' · ')}
          </p>
        )}
        <p className="text-label-md text-on-surface-variant flex items-center gap-1">
          <span className="material-symbols-rounded text-[16px]">event</span>
          {formatDate(capsule.createdAt)}에 남김
        </p>
        {capsule.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="material-symbols-rounded text-[16px] text-on-surface-variant">group</span>
            {capsule.tags.map((t) => (
              <span key={t.id} className="h-7 pl-0.5 pr-2.5 rounded-md surface border border-gray-200 text-gray-700 text-label-sm flex items-center gap-1">
                <Avatar profile={t} size={24} />
                <span className="font-bold">@{t.username}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {companions.length > 0 && (
        <section className="rounded-xl surface px-4 pt-3.5 pb-2 border border-gray-200">
          <div className="flex items-center gap-2">
            <span className="material-symbols-rounded icon-fill text-[22px] text-primary">waving_hand</span>
            <div>
              <h3 className="text-label-lg font-bold text-on-surface">여기 또 가자고 조르기</h3>
              <p className="text-label-sm text-on-surface-variant">같이 간 친구에게 알림이 가요</p>
            </div>
          </div>
          <ul className="mt-2 flex flex-col">
            {companions.map((friend) => (
              <li key={friend.id} className="flex items-center gap-2.5 py-1.5">
                <Avatar profile={friend} size={36} />
                <div className="flex-1 min-w-0">
                  <p className="text-label-lg font-bold text-on-surface truncate">{friend.displayName}</p>
                  <p className="text-label-sm text-on-surface-variant truncate">@{friend.username}</p>
                </div>
                <NudgeButton capsuleId={capsule.id} friend={friend} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {SOCIAL_ENABLED && isMine && (
        <button
          onClick={toggleVisibility}
          disabled={busy}
          className="flex items-center gap-3 px-4 py-3.5 rounded-xl fill-neutral border border-gray-200 text-left pressable disabled:opacity-60"
          type="button"
          role="switch"
          aria-checked={capsule.visibility === 'town'}
        >
          <span className="material-symbols-rounded text-[22px] text-gray-500">location_city</span>
          <span className="flex-1 min-w-0">
            <span className="block text-label-lg font-bold text-on-surface">동네에 공개</span>
            <span className="block text-label-sm text-on-surface-variant">
              {capsule.visibility === 'town' ? '동네 사람 누구나 피드와 가게에서 봐요. 함께한 친구 이름은 친구에게만 보여요' : '지금은 친구와 태그된 사람만 봐요'}
            </span>
          </span>
          <span className={`w-11 h-6 shrink-0 rounded-full p-0.5 transition-colors ${capsule.visibility === 'town' ? 'bg-primary' : 'bg-gray-300'}`}>
            <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${capsule.visibility === 'town' ? 'translate-x-5' : ''}`} />
          </span>
        </button>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={() => navigate(mapPath, { state: { placeId: capsule.placeId } })}
          className="h-12 rounded-lg fill-neutral border border-gray-200 text-gray-700 text-label-lg flex items-center justify-center gap-1.5 pressable"
          type="button"
        >
          <span className="material-symbols-rounded text-[20px] text-gray-500">map</span> 지도에서 보기
        </button>
        {isMine ? (
          <button
            onClick={handleDelete}
            disabled={busy}
            className="h-12 rounded-lg bg-error-container text-on-error-container text-label-lg flex items-center justify-center gap-1.5 pressable disabled:opacity-50"
            type="button"
          >
            <span className="material-symbols-rounded text-[20px]">delete</span> 삭제
          </button>
        ) : taggedMe ? (
          <button
            onClick={handleUntag}
            disabled={busy}
            className="h-12 rounded-lg fill-neutral border border-gray-200 text-gray-700 text-label-lg flex items-center justify-center gap-1.5 pressable disabled:opacity-50"
            type="button"
          >
            <span className="material-symbols-rounded text-[20px]">label_off</span> 내 태그 빼기
          </button>
        ) : null}
      </div>
    </div>
  );
}
