import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from '../components/Avatar';
import CapsuleThumb from '../components/CapsuleThumb';
import FilmDate from '../components/FilmDate';
import MyTownCard from '../components/MyTownCard';
import { useAuth } from '../hooks/useAuth';
import { useCapsules } from '../hooks/useCapsules';
import { useFriendships } from '../hooks/useFriendships';
import { SOCIAL_ENABLED } from '../lib/capsuleStore';
import { formatDate } from '../lib/format';
import { isAutoUsername } from '../lib/social';
import type { Capsule } from '../types/capsule';

type Tab = 'mine' | 'tagged';

export default function MyLog() {
  const navigate = useNavigate();
  const { session, profile } = useAuth();
  const me = session?.user.id ?? '';
  const capsules = useCapsules();
  const { list: friendships } = useFriendships();
  const [tab, setTab] = useState<Tab>('mine');

  if (!capsules) return null;

  // 내 지도에는 내가 남긴 영상과 친구가 나를 태그한 영상이 함께 있다
  const mine = SOCIAL_ENABLED ? capsules.filter((c) => c.userId === me) : capsules;
  const tagged = SOCIAL_ENABLED ? capsules.filter((c) => c.userId !== me) : [];
  const shown = tab === 'mine' ? mine : tagged;
  const friendCount = friendships?.filter((f) => f.status === 'friend').length ?? 0;
  const requestCount = friendships?.filter((f) => f.status === 'incoming').length ?? 0;

  const tabButton = (value: Tab, label: string, count: number) => (
    <button
      onClick={() => setTab(value)}
      className={`flex-1 h-12 -mb-px border-b-2 text-label-lg transition-colors ${
        tab === value ? 'border-on-surface text-on-surface font-bold' : 'border-transparent text-gray-400'
      }`}
      type="button"
      aria-pressed={tab === value}
    >
      {label} {count}
    </button>
  );

  return (
    <div className="flex flex-col w-full pb-8 pt-5 gap-4">
      {SOCIAL_ENABLED ? (
        <>
          <section className="flex items-center gap-4 px-1">
            {/* 프로필 사진에 노을빛 테두리 */}
            <span className="shrink-0 p-[3px] rounded-full bg-sunset">
              <span className="block p-[3px] rounded-full bg-paper">
                <Avatar profile={profile} size={64} />
              </span>
            </span>
            <div className="flex-1 min-w-0">
              <h2 className="font-serif text-[24px] font-bold leading-snug text-on-surface truncate">{profile?.displayName ?? '나'}</h2>
              {profile && <p className="text-label-md text-on-surface-variant truncate">@{profile.username}</p>}
            </div>
          </section>
          {profile && isAutoUsername(profile.username) && (
            <button
              onClick={() => navigate('/profile')}
              className="w-full flex items-center gap-2.5 px-4 py-3.5 rounded-2xl bg-primary-fixed text-on-primary-fixed text-left pressable"
              type="button"
            >
              <span className="material-symbols-rounded text-[20px] text-primary">badge</span>
              <span className="flex-1 text-label-md font-semibold">친구가 나를 찾을 수 있게 아이디를 정해 주세요</span>
              <span className="material-symbols-rounded text-[18px]">chevron_right</span>
            </button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => navigate('/friends')}
              className="relative h-11 rounded-full btn-paper text-label-lg flex items-center justify-center gap-1.5 pressable"
              type="button"
            >
              <span className="material-symbols-rounded text-[20px] text-gray-500">group</span>
              친구 {friendCount}
              {requestCount > 0 && (
                <span className="absolute -top-1 right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-on-primary text-[11px] font-bold leading-[18px] text-center ring-2 ring-paper">
                  {requestCount}
                </span>
              )}
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="h-11 rounded-full btn-paper text-label-lg flex items-center justify-center gap-1.5 pressable"
              type="button"
            >
              <span className="material-symbols-rounded text-[20px] text-gray-500">edit</span>
              프로필 편집
            </button>
          </div>
          <MyTownCard capsules={capsules} />
          <div className="flex border-b border-gray-200">
            {tabButton('mine', '내 영상', mine.length)}
            {tabButton('tagged', '태그된 영상', tagged.length)}
          </div>
        </>
      ) : (
        <>
          <MyTownCard capsules={capsules} />
          <div className="mt-2 px-1">
            <div className="flex items-baseline justify-between">
              <h2 className="font-serif text-[22px] font-bold text-on-surface">내 영상</h2>
              <span className="text-label-md text-on-surface-variant">{capsules.length}개</span>
            </div>
            <p className="text-label-sm text-on-surface-variant">영상은 이 기기 브라우저에만 저장돼요.</p>
          </div>
        </>
      )}

      {shown.length === 0 ? (
        <div className="flex flex-col items-center text-center py-12 px-6 app-card text-on-surface-variant">
          <div className="w-16 h-16 rounded-full bg-primary-fixed text-primary flex items-center justify-center">
            <span className="material-symbols-rounded text-[32px] icon-fill">{tab === 'mine' ? 'videocam' : 'sell'}</span>
          </div>
          <p className="mt-4 text-body-md">{tab === 'mine' ? '아직 남긴 영상이 없어요.' : '친구가 나를 태그한 영상이 여기에 모여요.'}</p>
          {tab === 'mine' && (
            <button onClick={() => navigate('/leave')} className="mt-5 h-12 px-6 rounded-2xl bg-sunset shadow-glow text-label-lg font-bold pressable" type="button">
              첫 5초 남기기
            </button>
          )}
        </div>
      ) : (
        // 앨범에 꽂아 둔 폴라로이드처럼
        <div className="grid grid-cols-2 gap-x-3 gap-y-4 pt-1">
          {shown.map((c) => (
            <CapsuleCard key={c.id} capsule={c} showAuthor={tab === 'tagged'} onOpen={() => navigate(`/video/${c.id}`)} />
          ))}
        </div>
      )}

      <button onClick={() => navigate('/privacy')} className="mt-10 self-center text-label-sm text-gray-400 underline underline-offset-2" type="button">
        개인정보처리방침
      </button>
    </div>
  );
}

/** 폴라로이드 한 장: 사진 구석에 필름 날짜, 아래 여백에 가게 이름을 손글씨로 */
function CapsuleCard({ capsule: c, showAuthor, onOpen }: { capsule: Capsule; showAuthor: boolean; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="polaroid flex flex-col text-left pressable" type="button">
      <div className="polaroid-photo w-full aspect-[3/4]">
        <CapsuleThumb thumbnail={c.thumbnail} />
        <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-black/40 backdrop-blur-sm text-white text-[11px] flex items-center gap-0.5">
          <span className="material-symbols-rounded text-[12px]">play_arrow</span>
          {Math.round(c.clipDuration)}초
        </span>
        {c.tags.length > 0 && (
          <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-black/40 backdrop-blur-sm text-white text-[11px] flex items-center gap-0.5">
            <span className="material-symbols-rounded text-[12px]">group</span>
            {c.tags.length}
          </span>
        )}
        {showAuthor && c.author && <Avatar profile={c.author} size={28} className="absolute top-1.5 left-1.5 ring-2 ring-white" />}
        <FilmDate at={c.createdAt} className="bottom-2 right-2 text-[10px]" />
      </div>
      <div className="px-1 pt-1.5 pb-2 min-w-0 w-full">
        <p className="font-hand text-[22px] leading-[1.15] text-on-surface truncate">{c.placeName}</p>
        <p className="text-label-sm text-on-surface-variant truncate">
          {showAuthor && c.author ? `${c.author.displayName} · ` : ''}
          {formatDate(c.createdAt)}
        </p>
      </div>
    </button>
  );
}
