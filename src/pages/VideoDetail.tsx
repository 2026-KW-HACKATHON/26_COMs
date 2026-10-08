import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Avatar from '../components/Avatar';
import CapsuleVideo from '../components/CapsuleVideo';
import LikeButton from '../components/LikeButton';
import NudgeButton from '../components/NudgeButton';
import { CATEGORY_EMOJI, getPlace, placeSubtitle } from '../data/places';
import { useAuth } from '../hooks/useAuth';
import { useFriendships } from '../hooks/useFriendships';
import { useLike } from '../hooks/useLike';
import { SOCIAL_ENABLED, deleteCapsule, getCapsule, setVisibility } from '../lib/capsuleStore';
import { formatDate, formatRelative } from '../lib/format';
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

  const openMap = () => navigate(mapPath, { state: { placeId: capsule.placeId } });
  const authorName = !SOCIAL_ENABLED || isMine ? '나' : (capsule.author?.displayName ?? '친구');

  return (
    <div className="flex flex-col w-full pb-8">
      <div className="bleed">
        {/* 게시물: 작성자 → 가게(위치) → 영상 → 하트·지도 → 자세한 정보 */}
        <article className="row-x pt-4 pb-3">
          <div className="flex items-center gap-3">
            <Avatar profile={capsule.author ?? { displayName: authorName, avatarUrl: null }} size={40} />
            <div className="flex-1 min-w-0">
              <p className="flex items-center gap-1.5 min-w-0">
                <span className="truncate text-label-lg font-bold text-on-surface">{authorName}</span>
                {SOCIAL_ENABLED && capsule.author && <span className="shrink-0 text-label-md text-gray-400">@{capsule.author.username}</span>}
              </p>
              <p className="text-label-sm text-gray-400">
                {formatRelative(capsule.createdAt)}
                {capsule.visibility === 'town' && ' · 동네 공개'}
              </p>
            </div>
          </div>

          <button onClick={openMap} className="mt-3 block max-w-full text-left" type="button">
            <span className="block text-headline-sm text-on-surface truncate">
              <span className="mr-1.5 font-normal">{(place && CATEGORY_EMOJI[place.category]) ?? '📍'}</span>
              {capsule.placeName}
            </span>
            {place && <span className="block text-label-md text-on-surface-variant truncate">{[placeSubtitle(place), place.address].filter(Boolean).join(' · ')}</span>}
          </button>

          <CapsuleVideo
            src={capsule.video}
            start={capsule.clipStart}
            duration={capsule.clipDuration}
            onLike={like.like}
            className="mt-3 w-full aspect-[3/4] rounded-lg border border-gray-200"
          />

          <div className="mt-1 flex items-center gap-1">
            <LikeButton like={like} />
            <button onClick={openMap} className="h-10 px-2 rounded-lg flex items-center gap-1 text-label-md text-gray-600 active:bg-gray-100" type="button">
              <span className="material-symbols-rounded text-[22px]">location_on</span>
              지도에서 보기
            </button>
          </div>

          <p className="mt-1 text-label-md text-on-surface-variant">{formatDate(capsule.createdAt)}에 남김</p>
          {capsule.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-label-md text-on-surface">
              <span className="text-on-surface-variant">함께</span>
              {capsule.tags.map((t) => (
                <span key={t.id} className="flex items-center gap-1">
                  <Avatar profile={t} size={22} />
                  <span className="font-semibold">@{t.username}</span>
                </span>
              ))}
            </div>
          )}
        </article>

        {companions.length > 0 && (
          <section className="border-t border-gray-200 pt-3.5 pb-1">
            <div className="row-x">
              <h3 className="text-label-lg font-bold text-on-surface">여기 또 가자고 조르기</h3>
              <p className="text-label-sm text-on-surface-variant">같이 간 친구에게 알림이 가요</p>
            </div>
            <ul className="mt-1 flex flex-col">
              {companions.map((friend) => (
                <li key={friend.id} className="row-x flex items-center gap-2.5 py-2">
                  <Avatar profile={friend} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-label-lg font-semibold text-on-surface truncate">{friend.displayName}</p>
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
            className="row-x w-full flex items-center gap-3 py-3.5 border-t border-gray-200 text-left active:bg-gray-50 disabled:opacity-60"
            type="button"
            role="switch"
            aria-checked={capsule.visibility === 'town'}
          >
            <span className="flex-1 min-w-0">
              <span className="block text-label-lg font-semibold text-on-surface">동네에 공개</span>
              <span className="block text-label-sm text-on-surface-variant">
                {capsule.visibility === 'town' ? '동네 사람 누구나 피드와 가게에서 봐요. 함께한 친구 이름은 친구에게만 보여요' : '지금은 친구와 태그된 사람만 봐요'}
              </span>
            </span>
            <span className={`w-11 h-6 shrink-0 rounded-full p-0.5 transition-colors ${capsule.visibility === 'town' ? 'bg-primary' : 'bg-gray-300'}`}>
              <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${capsule.visibility === 'town' ? 'translate-x-5' : ''}`} />
            </span>
          </button>
        )}

        {isMine ? (
          <button
            onClick={handleDelete}
            disabled={busy}
            className="row-x w-full flex items-center gap-2 py-3.5 border-y border-gray-200 text-left text-label-lg font-semibold text-error active:bg-gray-50 disabled:opacity-50"
            type="button"
          >
            <span className="material-symbols-rounded text-[20px]">delete</span> 영상 삭제
          </button>
        ) : taggedMe ? (
          <button
            onClick={handleUntag}
            disabled={busy}
            className="row-x w-full flex items-center gap-2 py-3.5 border-y border-gray-200 text-left text-label-lg font-semibold text-gray-700 active:bg-gray-50 disabled:opacity-50"
            type="button"
          >
            <span className="material-symbols-rounded text-[20px]">label_off</span> 내 태그 빼기
          </button>
        ) : (
          <div className="border-t border-gray-200" />
        )}
      </div>
    </div>
  );
}
