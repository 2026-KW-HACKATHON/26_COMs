import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Avatar from '../components/Avatar';
import FeedVideo from '../components/FeedVideo';
import LikeButton from '../components/LikeButton';
import RecallCard from '../components/RecallCard';
import { CATEGORY_EMOJI, getPlace, placeSubtitle } from '../data/places';
import { useAuth } from '../hooks/useAuth';
import { useFriendships } from '../hooks/useFriendships';
import { useLike } from '../hooks/useLike';
import { usePlaceRanking } from '../hooks/usePlaceRanking';
import { SOCIAL_ENABLED, listFeed } from '../lib/capsuleStore';
import { formatRelative } from '../lib/format';
import { DEFAULT_RANKING_DAYS, MEDALS, type RankedPlace } from '../lib/ranking';
import { FEED_PAGE, type Capsule } from '../types/capsule';

type Scope = 'friends' | 'town';

const SCOPES: { value: Scope; label: string; title: string; description: string }[] = [
  { value: 'friends', label: '친구', title: '친구들이 다녀온 곳', description: '친구가 남긴 5초를 보고, 다음엔 같이 가 봐요.' },
  { value: 'town', label: '동네', title: '동네 사람들이 다녀온 곳', description: '월계1동 주민들이 동네에 공개한 5초예요.' },
];

/** 피드: 나와 친구들(또는 동네 사람들)이 최근 다녀온 가게를 5초 영상으로 */
export default function Feed() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // ?tab=town이면 동네 피드 (기기 저장은 동네가 없어서 늘 친구 피드)
  const scope: Scope = SOCIAL_ENABLED && searchParams.get('tab') === 'town' ? 'town' : 'friends';
  const scopeInfo = SCOPES.find((s) => s.value === scope)!;
  const me = useAuth().session?.user.id ?? '';
  const { list: friendships } = useFriendships();
  const friendIds = useMemo(() => friendships?.filter((f) => f.status === 'friend').map((f) => f.id) ?? null, [friendships]);
  const ranking = usePlaceRanking(DEFAULT_RANKING_DAYS);
  const rankOf = useMemo(() => new Map(ranking?.map((r) => [r.placeId, r])), [ranking]);

  // 탭을 바꾸면 이전 탭 목록이 잠깐 보이지 않도록 어느 탭의 목록인지 함께 기억한다
  const [loaded, setLoaded] = useState<{ scope: Scope; list: Capsule[]; failed: boolean } | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // 친구 피드는 친구 목록이 오면(서버 저장) 나와 친구들의 기록을, 동네 피드는 동네 공개 기록을 불러온다
  const userIds = useMemo(() => (SOCIAL_ENABLED ? (friendIds ? [me, ...friendIds] : null) : []), [friendIds, me]);
  const ready = scope === 'town' || userIds !== null;
  const load = useCallback(
    (before?: number) => (scope === 'town' ? listFeed({ scope, before }) : listFeed({ scope, userIds: userIds ?? [], before })),
    [scope, userIds],
  );

  useEffect(() => {
    let alive = true;
    if (!ready) return;
    load()
      .then((page) => {
        if (!alive) return;
        setLoaded({ scope, list: page, failed: false });
        setHasMore(page.length === FEED_PAGE);
      })
      .catch((err) => {
        console.error(err);
        if (alive) setLoaded({ scope, list: [], failed: true });
      });
    return () => {
      alive = false;
    };
  }, [load, ready, scope]);

  const items = loaded?.scope === scope ? loaded.list : null;
  const failed = !!loaded?.failed;

  const loadMore = async () => {
    if (!items?.length || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await load(items[items.length - 1].createdAt);
      setHasMore(page.length === FEED_PAGE);
      const seen = new Set(items.map((c) => c.id));
      setLoaded({ scope, list: [...items, ...page.filter((c) => !seen.has(c.id))], failed: false });
    } catch (err) {
      console.error(err);
      alert('더 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoadingMore(false);
    }
  };

  const openOnMap = (c: Capsule) => navigate('/?view=town', { state: { placeId: c.placeId } });

  const selectScope = (s: Scope) => setSearchParams(s === 'town' ? { tab: 'town' } : {}, { replace: true });

  return (
    <div className="flex flex-col w-full pt-3 pb-8 gap-4">
      {SOCIAL_ENABLED && (
        <div className="flex p-1 rounded-full bg-white/90 border border-gray-100 shadow-[0_10px_26px_rgba(15,23,42,0.06)]" role="tablist" aria-label="피드">
          {SCOPES.map((s) => (
            <button
              key={s.value}
              onClick={() => selectScope(s.value)}
              className={`flex-1 h-10 rounded-full text-label-md font-semibold transition-all ${
                scope === s.value ? 'bg-white text-on-surface shadow-[0_8px_22px_rgba(15,23,42,0.08)]' : 'text-gray-500'
              }`}
              type="button"
              role="tab"
              aria-selected={scope === s.value}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      {/* 기념일(일주일·한 달·100일·1년 전 오늘)에 남긴 내 영상 */}
      {scope === 'friends' && <RecallCard />}
      <div className="px-1 pt-1">
        <h2 className="mb-1 text-headline-md text-on-surface">{scopeInfo.title}</h2>
        <p className="text-body-sm text-on-surface-variant">{scopeInfo.description}</p>
      </div>

      {items === null ? (
        <FeedSkeleton />
      ) : failed ? (
        <p className="py-10 text-center text-body-md text-on-surface-variant">피드를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
      ) : items.length === 0 ? (
        <EmptyFeed scope={scope} noFriends={SOCIAL_ENABLED && friendIds?.length === 0} onTown={() => selectScope('town')} />
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
  const like = useLike(c);
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
    <article className="flex flex-col gap-3 app-card overflow-hidden">
      <button onClick={onOpen} className="flex items-center gap-3 text-left px-4 pt-4" type="button">
        {SOCIAL_ENABLED && <Avatar profile={c.author} size={36} />}
        <span className="flex-1 min-w-0">
          <span className="block text-label-lg text-on-surface truncate">
            <b>{name}</b>
            {withText && <span className="text-on-surface-variant"> · {withText}</span>}
          </span>
          <span className="flex items-center gap-1 text-label-sm text-on-surface-variant">
            {formatRelative(c.createdAt)}
            {c.visibility === 'town' && (
              <>
                <span aria-hidden>·</span>
                <span className="material-symbols-rounded text-[14px]">location_city</span>
                동네 공개
              </>
            )}
          </span>
        </span>
        <span className="material-symbols-rounded text-[20px] text-gray-400">more_horiz</span>
      </button>

      <div className="px-4">
        <FeedVideo capsule={c} onLike={like.like} className="w-full aspect-[4/5] rounded-[24px] overflow-hidden" />
      </div>

      <div className="flex items-center px-4 -my-1.5">
        <LikeButton like={like} />
      </div>

      <button onClick={onMap} className="flex items-center gap-3 px-4 pb-4 pt-1 text-left pressable" type="button">
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

function EmptyFeed({ scope, noFriends, onTown }: { scope: Scope; noFriends: boolean; onTown: () => void }) {
  const navigate = useNavigate();
  const town = scope === 'town';
  const findFriends = !town && noFriends;
  const title = town ? '아직 동네에 공개된 영상이 없어요' : findFriends ? '친구를 추가하면 친구가 다녀온 가게가 여기에 떠요' : '아직 남긴 영상이 없어요';
  const hint = town ? "영상을 남길 때 '동네 모두'를 고르면 여기에 떠요." : findFriends ? '같은 동네 친구를 찾아 보세요.' : '가게에서 5초를 남기면 친구들 피드에 떠요.';
  return (
    <div className="flex flex-col items-center text-center py-14 px-6 app-card text-on-surface-variant">
      <div className="w-16 h-16 rounded-full instagram-gradient flex items-center justify-center text-white shadow-[0_16px_30px_rgba(225,48,108,0.24)]">
        <span className="material-symbols-rounded text-[34px] icon-fill">{town ? 'location_city' : findFriends ? 'group_add' : 'dynamic_feed'}</span>
      </div>
      <p className="mt-2 text-body-md text-on-surface">{title}</p>
      <p className="mt-1 text-label-md">{hint}</p>
      <button
        onClick={() => navigate(findFriends ? '/friends' : '/leave')}
        className="mt-5 h-12 px-6 rounded-full instagram-gradient text-white text-label-lg font-bold pressable shadow-[0_12px_24px_rgba(225,48,108,0.26)]"
        type="button"
      >
        {findFriends ? '친구 찾기' : '5초 남기기'}
      </button>
      {findFriends && (
        <button onClick={onTown} className="mt-2 h-10 px-4 text-label-md font-semibold text-gray-600" type="button">
          동네 피드 먼저 보기
        </button>
      )}
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="flex flex-col w-full gap-7 animate-pulse" aria-label="불러오는 중">
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-3 app-card overflow-hidden p-4">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-full bg-gray-100" />
            <span className="w-32 h-4 rounded-full bg-gray-100" />
          </div>
          <div className="w-full aspect-[4/5] rounded-[24px] bg-gray-100" />
        </div>
      ))}
    </div>
  );
}
