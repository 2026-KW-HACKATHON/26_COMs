import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from '../components/Avatar';
import FeedVideo from '../components/FeedVideo';
import { CATEGORY_EMOJI, getPlace, placeSubtitle } from '../data/places';
import { useAuth } from '../hooks/useAuth';
import { useFriendships } from '../hooks/useFriendships';
import { usePlaceRanking } from '../hooks/usePlaceRanking';
import { SOCIAL_ENABLED, listFeed } from '../lib/capsuleStore';
import { formatRelative } from '../lib/format';
import { DEFAULT_RANKING_DAYS, MEDALS, type RankedPlace } from '../lib/ranking';
import { FEED_PAGE, type Capsule } from '../types/capsule';

/** 피드: 나와 친구들이 최근 다녀온 가게를 5초 영상으로 */
export default function Feed() {
  const navigate = useNavigate();
  const me = useAuth().session?.user.id ?? '';
  const { list: friendships } = useFriendships();
  const friendIds = useMemo(() => friendships?.filter((f) => f.status === 'friend').map((f) => f.id) ?? null, [friendships]);
  const ranking = usePlaceRanking(DEFAULT_RANKING_DAYS);
  const rankOf = useMemo(() => new Map(ranking?.map((r) => [r.placeId, r])), [ranking]);

  const [items, setItems] = useState<Capsule[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);

  // 친구 목록이 오면(서버 저장) 나와 친구들의 기록을 불러온다
  const userIds = useMemo(() => (SOCIAL_ENABLED ? (friendIds ? [me, ...friendIds] : null) : []), [friendIds, me]);
  const load = useCallback((before?: number) => (userIds ? listFeed({ userIds, before }) : Promise.resolve([])), [userIds]);

  useEffect(() => {
    let alive = true;
    if (!userIds) return;
    load()
      .then((page) => {
        if (!alive) return;
        setItems(page);
        setHasMore(page.length === FEED_PAGE);
      })
      .catch((err) => {
        console.error(err);
        if (alive) {
          setFailed(true);
          setItems([]);
        }
      });
    return () => {
      alive = false;
    };
  }, [load, userIds]);

  const loadMore = async () => {
    if (!items?.length || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await load(items[items.length - 1].createdAt);
      setHasMore(page.length === FEED_PAGE);
      const seen = new Set(items.map((c) => c.id));
      setItems([...items, ...page.filter((c) => !seen.has(c.id))]);
    } catch (err) {
      console.error(err);
      alert('더 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoadingMore(false);
    }
  };

  const openOnMap = (c: Capsule) => navigate('/?view=town', { state: { placeId: c.placeId } });

  if (items === null) return <FeedSkeleton />;

  return (
    <div className="flex flex-col w-full pt-3 pb-6">
      <h2 className="mb-1 text-headline-md text-on-surface">친구들이 다녀온 곳</h2>
      <p className="mb-4 text-body-sm text-on-surface-variant">친구가 남긴 5초를 보고, 다음엔 같이 가 봐요.</p>

      {failed ? (
        <p className="py-10 text-center text-body-md text-on-surface-variant">피드를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
      ) : items.length === 0 ? (
        <EmptyFeed noFriends={SOCIAL_ENABLED && friendIds?.length === 0} />
      ) : (
        <div className="flex flex-col gap-7">
          {items.map((c) => (
            <FeedItem key={c.id} capsule={c} me={me} stat={rankOf.get(c.placeId)} onOpen={() => navigate(`/video/${c.id}`)} onMap={() => openOnMap(c)} />
          ))}
          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="h-12 rounded-xl bg-surface-container text-gray-700 text-label-lg flex items-center justify-center gap-1 pressable disabled:opacity-50"
              type="button"
            >
              {loadingMore ? '불러오는 중…' : '더 보기'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface FeedItemProps {
  capsule: Capsule;
  me: string;
  stat: RankedPlace | undefined;
  onOpen: () => void;
  onMap: () => void;
}

function FeedItem({ capsule: c, me, stat, onOpen, onMap }: FeedItemProps) {
  const place = getPlace(c.placeId);
  const mine = !SOCIAL_ENABLED || c.userId === me;
  const name = mine ? '나' : (c.author?.displayName ?? '친구');
  const others = c.tags.filter((t) => t.id !== c.userId);
  const first = others[0];
  const withText = !first
    ? ''
    : others.length > 1
      ? `${first.id === me ? '나' : `${first.displayName}님`} 외 ${others.length - 1}명과 함께`
      : first.id === me
        ? '나와 함께'
        : `${first.displayName}님과 함께`;

  return (
    <article className="flex flex-col gap-2.5">
      <button onClick={onOpen} className="flex items-center gap-2.5 text-left" type="button">
        {SOCIAL_ENABLED && <Avatar profile={c.author} size={36} />}
        <span className="flex-1 min-w-0">
          <span className="block text-label-lg text-on-surface truncate">
            <b>{name}</b>
            {withText && <span className="text-on-surface-variant"> · {withText}</span>}
          </span>
          <span className="block text-label-sm text-on-surface-variant">{formatRelative(c.createdAt)}</span>
        </span>
        <span className="material-symbols-rounded text-[20px] text-gray-400">more_horiz</span>
      </button>

      <FeedVideo capsule={c} className="w-full aspect-[4/5] rounded-2xl" />

      <button onClick={onMap} className="flex items-center gap-3 p-2.5 pr-3 rounded-2xl bg-surface-container-low text-left pressable" type="button">
        <span className="w-10 h-10 shrink-0 rounded-full bg-surface flex items-center justify-center text-[20px]">
          {(place && CATEGORY_EMOJI[place.category]) ?? '📍'}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-label-lg font-bold text-on-surface truncate">{c.placeName}</span>
          <span className="block text-label-sm text-on-surface-variant truncate">
            {[place && placeSubtitle(place), stat && `${MEDALS[stat.rank - 1] ?? ''}동네 ${stat.rank}위`].filter(Boolean).join(' · ')}
          </span>
        </span>
        <span className="shrink-0 flex items-center text-label-md font-semibold text-gray-500">
          지도
          <span className="material-symbols-rounded text-[18px]">chevron_right</span>
        </span>
      </button>
    </article>
  );
}

function EmptyFeed({ noFriends }: { noFriends: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center text-center py-14 px-6 rounded-2xl bg-surface-container-low text-on-surface-variant">
      <span className="material-symbols-rounded text-[40px] text-gray-300">{noFriends ? 'group_add' : 'dynamic_feed'}</span>
      <p className="mt-2 text-body-md text-on-surface">{noFriends ? '친구를 추가하면 친구가 다녀온 가게가 여기에 떠요' : '아직 남긴 영상이 없어요'}</p>
      <p className="mt-1 text-label-md">{noFriends ? '같은 동네 친구를 찾아 보세요.' : '가게에서 5초를 남기면 친구들 피드에 떠요.'}</p>
      <button
        onClick={() => navigate(noFriends ? '/friends' : '/leave')}
        className="mt-5 h-12 px-6 rounded-xl bg-primary text-on-primary text-label-lg font-bold pressable"
        type="button"
      >
        {noFriends ? '친구 찾기' : '5초 남기기'}
      </button>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="flex flex-col w-full pt-3 gap-7 animate-pulse" aria-label="불러오는 중">
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-full bg-surface-container" />
            <span className="w-32 h-4 rounded bg-surface-container" />
          </div>
          <div className="w-full aspect-[4/5] rounded-2xl bg-surface-container" />
        </div>
      ))}
    </div>
  );
}
