import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Avatar from '../components/Avatar';
import CapsuleThumb from '../components/CapsuleThumb';
import FriendMapSelector from '../components/FriendMapSelector';
import PlaceMap, { type PlaceMark } from '../components/PlaceMap';
import PlaceSearch from '../components/PlaceSearch';
import { useAuth } from '../hooks/useAuth';
import { useCapsules } from '../hooks/useCapsules';
import { useFriendships } from '../hooks/useFriendships';
import { usePlaceRanking } from '../hooks/usePlaceRanking';
import { SOCIAL_ENABLED, listPlaceCapsules } from '../lib/capsuleStore';
import { DEFAULT_RANKING_DAYS, MEDALS, RANKING_PERIODS } from '../lib/ranking';
import { isUuid } from '../lib/supabase';
import { daysAgo, myPlaceVisits, summarizeVisits, type MyPlaceVisit } from '../lib/visits';
import { placesInSameBuilding } from '../data/mapData';
import { CATEGORY_EMOJI, getPlace, placeSubtitle } from '../data/places';
import type { Capsule } from '../types/capsule';

const NO_CAPSULES: Capsule[] = [];
const PERIOD_LABEL = RANKING_PERIODS.find((p) => p.days === DEFAULT_RANKING_DAYS)!.label;
/** 아래 랭킹 카드가 1~3위를 돌아가며 보여 주는 간격 */
const TICKER_MS = 3500;

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, profile, loading: authLoading } = useAuth();
  const me = session?.user.id ?? null;

  // ?user=<친구 id>면 그 친구의 지도, ?view=town이면 동네 지도(모두의 방문 수), 없으면 내 지도.
  // 로그인하지 않았으면 내 지도가 없어서 동네 지도를 보여 준다
  const userParam = searchParams.get('user');
  const viewingId = SOCIAL_ENABLED && me && isUuid(userParam) && userParam !== me ? userParam : null;
  const town = SOCIAL_ENABLED && !viewingId && (searchParams.get('view') === 'town' || (!authLoading && !me));
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

  // 동네 랭킹: 동네 지도의 색·메달, 가게 시트의 순위, 아래 랭킹 카드에 쓴다
  const ranking = usePlaceRanking(DEFAULT_RANKING_DAYS);
  const rankOf = useMemo(() => new Map(ranking?.map((r) => [r.placeId, r])), [ranking]);
  const townVisits = useMemo(() => new Map(ranking?.map((r) => [r.placeId, r.visits])), [ranking]);
  const medals = useMemo(
    () => new Map<string, PlaceMark>(ranking?.filter((r) => r.rank <= 3).map((r) => [r.placeId, { emoji: MEDALS[r.rank - 1] }])),
    [ranking],
  );

  // 내 방문 (내 지도·동네 지도일 때 capsules는 내 기록): 단골은 별, 오래 안 간 곳은 "오랜만"
  const myVisits = useMemo(() => (viewingId ? new Map<string, MyPlaceVisit>() : myPlaceVisits(capsules ?? [])), [viewingId, capsules]);
  const mySummary = useMemo(() => summarizeVisits(myVisits), [myVisits]);
  const myMarks = useMemo(
    () =>
      new Map<string, PlaceMark>(
        [...myVisits.values()].filter((v) => v.regular || v.due).map((v) => [v.placeId, { emoji: v.regular ? '⭐' : undefined, note: v.due ? '오랜만' : undefined }]),
      ),
    [myVisits],
  );
  const [tick, setTick] = useState(0);
  const tickerSize = Math.min(3, ranking?.length ?? 0);
  useEffect(() => {
    if (tickerSize < 2) return;
    const timer = setInterval(() => setTick((t) => t + 1), TICKER_MS);
    return () => clearInterval(timer);
  }, [tickerSize]);
  const featured = tickerSize ? ranking![tick % tickerSize] : null;

  // 동네 지도에서 가게를 고르면 그 가게에서 내가 볼 수 있는 영상(내 것·친구 것·동네 공개)을 모두 보여 준다
  const [placeVideos, setPlaceVideos] = useState<{ placeId: string; list: Capsule[] } | null>(null);
  useEffect(() => {
    if (!town || !me || !selectedId) return;
    let alive = true;
    listPlaceCapsules(selectedId)
      .then((list) => alive && setPlaceVideos({ placeId: selectedId, list }))
      .catch((err) => console.error(err));
    return () => {
      alive = false;
    };
  }, [town, me, selectedId]);

  const selected = getPlace(selectedId);
  const selectedStat = selectedId ? rankOf.get(selectedId) : undefined;
  const myVisit = selectedId ? myVisits.get(selectedId) : undefined;
  const selectedVideos =
    town && me
      ? placeVideos?.placeId === selectedId
        ? placeVideos.list
        : NO_CAPSULES
      : (shown?.filter((c) => c.placeId === selectedId) ?? NO_CAPSULES);
  // 한 건물에 가게가 여럿이면 시트에서 바로 바꿀 수 있게
  const neighbors = selected ? placesInSameBuilding(selected) : [];
  const mapCount = town ? townVisits : videoCount;

  const selectMap = (friendId: string | null) => setSearchParams(friendId ? { user: friendId } : {}, { replace: true });
  const selectTown = () => setSearchParams({ view: 'town' }, { replace: true });

  const hint = viewingId
    ? viewing
      ? `${viewing.displayName}님의 지도예요`
      : friendships === null
        ? '친구 지도를 불러오는 중…'
        : '친구의 지도만 볼 수 있어요'
    : town && ranking?.length
      ? `${PERIOD_LABEL} 동안 동네 사람들이 다녀간 곳이에요`
      : !town && mySummary.visited
        ? `월계1동 ${mySummary.total}곳 중 ${mySummary.visited}곳 가 봤어요`
        : '가 본 가게를 눌러 5초를 남겨 보세요';

  return (
    <div className="relative w-full h-[calc(100dvh-7.5rem)]">
      <PlaceMap
        selectedId={selectedId}
        onSelect={(p) => setSelectedId(p.id)}
        videoCount={mapCount}
        marks={town ? medals : viewingId ? undefined : myMarks}
        className="absolute inset-0"
      />

      <div className="absolute top-3 inset-x-3 z-10 flex flex-col gap-2">
        <PlaceSearch onPick={(p) => setSelectedId(p.id)} />
        {SOCIAL_ENABLED && me && (
          <FriendMapSelector
            me={profile}
            friends={friends}
            selectedId={viewingId}
            onSelect={selectMap}
            town={town}
            onSelectTown={selectTown}
            requestCount={requestCount}
          />
        )}
      </div>

      {selected ? (
        <div className="absolute bottom-3 inset-x-3 z-10 bg-surface rounded-3xl p-5 shadow-sheet flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <span className="w-11 h-11 shrink-0 rounded-full bg-surface-container flex items-center justify-center text-[22px]">
              {CATEGORY_EMOJI[selected.category] ?? '📍'}
            </span>
            <div className="flex-1 min-w-0 pt-0.5">
              <h2 className="text-headline-sm text-on-surface truncate">{selected.name}</h2>
              <p className="text-label-md text-on-surface-variant truncate">
                {[placeSubtitle(selected), selected.address].filter(Boolean).join(' · ')}
              </p>
            </div>
            <button onClick={() => setSelectedId(null)} className="w-8 h-8 shrink-0 rounded-full bg-surface-container text-gray-500 flex items-center justify-center pressable" type="button" aria-label="닫기">
              <span className="material-symbols-rounded text-[20px]">close</span>
            </button>
          </div>

          {/* 동네에서 이 가게의 순위 (영상은 비공개, 숫자만) */}
          {selectedStat ? (
            <button
              onClick={() => navigate('/ranking')}
              className="-mt-1 flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-primary-fixed text-on-primary-fixed text-label-md font-semibold text-left pressable"
              type="button"
            >
              <span className="text-[17px] leading-none">{MEDALS[selectedStat.rank - 1] ?? '🏆'}</span>
              <span className="flex-1 min-w-0 truncate">
                동네 {selectedStat.rank}위 · {PERIOD_LABEL} {selectedStat.visits}번 방문
                {selectedStat.regulars > 0 && ` · 단골 ${selectedStat.regulars}명`}
              </span>
              <span className="material-symbols-rounded text-[18px]">chevron_right</span>
            </button>
          ) : (
            ranking && <p className="-mt-2 text-label-md text-on-surface-variant">{PERIOD_LABEL} 동안 다녀간 사람이 없어요. 처음으로 남겨 보세요</p>
          )}

          {/* 내 방문: 단골이면 별, 오래 안 갔으면 다시 가 보자고 */}
          {myVisit && (
            <p className={`-mt-1 flex items-center gap-1.5 text-label-md ${myVisit.due ? 'text-on-primary-fixed font-semibold' : 'text-on-surface-variant'}`}>
              <span className={`material-symbols-rounded text-[18px] ${myVisit.regular ? 'icon-fill text-primary' : ''}`}>{myVisit.regular ? 'star' : 'history'}</span>
              <span className="min-w-0 truncate">
                {myVisit.regular ? '단골 · ' : ''}나는 {myVisit.days}번 갔어요 · 마지막 {daysAgo(myVisit.daysSince)}
                {myVisit.due && ' · 오랜만이에요!'}
              </span>
            </p>
          )}

          {neighbors.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-5 px-5">
              {neighbors.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`h-8 shrink-0 px-3 rounded-full text-label-md font-semibold pressable ${
                    p.id === selected.id ? 'bg-inverse-surface text-inverse-on-surface' : 'bg-surface-container text-gray-700'
                  }`}
                  type="button"
                  aria-pressed={p.id === selected.id}
                >
                  {p.name}
                  {(mapCount.get(p.id) ?? 0) > 0 && <span className="ml-1 text-primary">{mapCount.get(p.id)}</span>}
                </button>
              ))}
            </div>
          )}

          {selectedVideos.length > 0 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
              {selectedVideos.map((c) => (
                <button key={c.id} onClick={() => navigate(`/video/${c.id}`)} className="relative w-[72px] h-24 shrink-0 rounded-xl overflow-hidden bg-surface-container pressable" type="button">
                  <CapsuleThumb thumbnail={c.thumbnail} />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/15 text-white">
                    <span className="material-symbols-rounded text-[24px] icon-fill">play_arrow</span>
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
            className="h-14 rounded-2xl bg-primary text-on-primary text-[16px] font-bold flex items-center justify-center gap-1.5 pressable"
            type="button"
          >
            <span className="material-symbols-rounded text-[22px]">videocam</span>
            여기에 5초 남기기
          </button>
        </div>
      ) : (
        <div className="absolute bottom-3 inset-x-3 z-10 flex flex-col items-center gap-2 pointer-events-none">
          <span className="px-4 py-2 rounded-full bg-inverse-surface/90 text-inverse-on-surface text-label-md font-semibold">{hint}</span>
          {/* 동네 랭킹 1~3위를 돌아가며 보여 주고, 누르면 전체 랭킹 */}
          {featured && (
            <button
              onClick={() => navigate('/ranking')}
              className="pointer-events-auto w-full h-16 pl-3 pr-2 rounded-2xl bg-surface shadow-sheet flex items-center gap-3 text-left pressable"
              type="button"
            >
              <span className="w-10 h-10 shrink-0 rounded-full bg-primary-fixed flex items-center justify-center text-[20px]">🏆</span>
              <span className="flex-1 min-w-0">
                <span className="block text-label-sm text-on-surface-variant">동네 랭킹 · {PERIOD_LABEL}</span>
                <span key={featured.placeId} className="block text-label-lg font-bold text-on-surface truncate ticker-in">
                  {MEDALS[featured.rank - 1] ?? `${featured.rank}위`} {featured.place.name}
                  <span className="ml-1.5 text-primary">{featured.visits}번 방문</span>
                </span>
              </span>
              <span className="material-symbols-rounded text-[22px] text-gray-400">chevron_right</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
