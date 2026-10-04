import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Avatar from '../components/Avatar';
import CapsuleThumb from '../components/CapsuleThumb';
import FriendMapSelector from '../components/FriendMapSelector';
import PlaceMap from '../components/PlaceMap';
import PlaceSearch from '../components/PlaceSearch';
import { useAuth } from '../hooks/useAuth';
import { useCapsules } from '../hooks/useCapsules';
import { useFriendships } from '../hooks/useFriendships';
import { SOCIAL_ENABLED } from '../lib/capsuleStore';
import { isUuid } from '../lib/supabase';
import { CATEGORY_EMOJI, PLACES, getPlace, placeSubtitle } from '../data/places';
import type { Capsule } from '../types/capsule';

const NO_CAPSULES: Capsule[] = [];

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, profile } = useAuth();
  const me = session?.user.id ?? null;

  // ?user=<친구 id>면 그 친구의 지도, 없으면 내 지도
  const userParam = searchParams.get('user');
  const viewingId = SOCIAL_ENABLED && me && isUuid(userParam) && userParam !== me ? userParam : null;
  const capsules = useCapsules(viewingId ?? undefined);
  const { list: friendships } = useFriendships();
  const friends = useMemo(() => friendships?.filter((f) => f.status === 'friend') ?? [], [friendships]);
  const viewing = viewingId ? friends.find((f) => f.id === viewingId) ?? null : null;
  const mapOwnerId = viewingId ?? me;
  const requestCount = friendships?.filter((f) => f.status === 'incoming').length ?? 0;
  // 친구가 아닌 사람(끊은 친구, 오래된 링크)의 지도는 보여 주지 않는다 (함께 태그된 영상만 남아 헷갈림)
  const notFriend = !!viewingId && friendships !== null && !viewing;
  const shown = notFriend ? NO_CAPSULES : capsules;

  // 남기기·영상 상세에서 넘어오면 해당 장소를 선택한 채로 연다
  const [selectedId, setSelectedId] = useState<string | null>((location.state as { placeId?: string } | null)?.placeId ?? null);

  const videoCount = useMemo(() => {
    const counts = new Map<string, number>();
    shown?.forEach((c) => counts.set(c.placeId, (counts.get(c.placeId) ?? 0) + 1));
    return counts;
  }, [shown]);

  const selected = getPlace(selectedId);
  const selectedVideos = shown?.filter((c) => c.placeId === selectedId) ?? [];

  const selectMap = (friendId: string | null) => setSearchParams(friendId ? { user: friendId } : {}, { replace: true });

  const hint = viewingId
    ? viewing
      ? `${viewing.displayName}님의 지도예요`
      : friendships === null
        ? '친구 지도를 불러오는 중…'
        : '친구의 지도만 볼 수 있어요'
    : '가게를 눌러 그곳의 5초를 남겨보세요';

  return (
    <div className="relative w-full h-[calc(100dvh-4rem)]">
      <PlaceMap
        places={PLACES}
        selectedId={selectedId}
        onSelect={(p) => setSelectedId(p.id)}
        videoCount={videoCount}
        className="absolute inset-0"
      />

      <div className="absolute top-3 inset-x-3 z-10 flex flex-col gap-2">
        <PlaceSearch onPick={(p) => setSelectedId(p.id)} />
        {SOCIAL_ENABLED && me && <FriendMapSelector me={profile} friends={friends} selectedId={viewingId} onSelect={selectMap} requestCount={requestCount} />}
      </div>

      {selected ? (
        <div className="absolute bottom-24 inset-x-3 z-10 bg-surface-container-lowest rounded-3xl p-4 shadow-xl flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <span className="w-11 h-11 shrink-0 rounded-full bg-primary-fixed flex items-center justify-center text-[22px]">
              {CATEGORY_EMOJI[selected.category] ?? '📍'}
            </span>
            <div className="flex-1 min-w-0">
              <h2 className="font-headline-sm text-headline-sm text-on-surface truncate">{selected.name}</h2>
              <p className="font-label-sm text-label-sm text-on-surface-variant truncate">
                {[placeSubtitle(selected), selected.address].filter(Boolean).join(' · ')}
              </p>
            </div>
            <button onClick={() => setSelectedId(null)} className="w-9 h-9 shrink-0 rounded-full bg-surface-container-low text-on-surface-variant flex items-center justify-center" type="button" aria-label="닫기">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {selectedVideos.length > 0 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {selectedVideos.map((c) => (
                <button key={c.id} onClick={() => navigate(`/video/${c.id}`)} className="relative w-16 h-20 shrink-0 rounded-lg overflow-hidden bg-surface-container" type="button">
                  <CapsuleThumb thumbnail={c.thumbnail} />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
                    <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                  </span>
                  {/* 지도 주인이 아닌 사람이 남긴 영상(지도 주인이 태그됨)은 작성자 사진을 표시 */}
                  {c.author && c.userId !== mapOwnerId && (
                    <Avatar profile={c.author} size={20} className="absolute top-1 left-1 ring-2 ring-white" />
                  )}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => navigate(`/leave?place=${encodeURIComponent(selected.id)}`)}
            className="h-12 rounded-xl bg-gradient-to-r from-secondary-container via-primary-container to-primary text-on-primary font-label-lg text-label-lg font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">videocam</span>
            여기에 5초 영상 남기기
          </button>
        </div>
      ) : (
        <div className="absolute bottom-24 inset-x-0 z-10 flex justify-center pointer-events-none">
          <span className="px-3 py-1.5 rounded-full bg-inverse-surface/85 text-inverse-on-surface font-label-md text-label-md shadow-md">{hint}</span>
        </div>
      )}
    </div>
  );
}
