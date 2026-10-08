import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from '../components/Avatar';
import CapsuleThumb from '../components/CapsuleThumb';
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
        tab === value ? 'border-on-surface text-on-surface font-bold' : 'border-transparent text-gray-500 font-medium'
      }`}
      type="button"
      aria-pressed={tab === value}
    >
      {label} {count}
    </button>
  );

  return (
    <div className="flex flex-col w-full pb-8">
      <div className="bleed">
        {SOCIAL_ENABLED ? (
          <>
            {/* 프로필 머리말: 이름·아이디와 사진, 아래에 친구·편집 버튼 */}
            <section className="row-x pt-5 pb-4">
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-headline-md text-on-surface truncate">{profile?.displayName ?? '나'}</h2>
                  {profile && <p className="text-label-md text-on-surface-variant truncate">@{profile.username} · 월계1동</p>}
                </div>
                <Avatar profile={profile} size={60} />
              </div>
              {profile && isAutoUsername(profile.username) && (
                <button onClick={() => navigate('/profile')} className="mt-3 w-full flex items-center gap-2 text-left text-label-md font-semibold text-primary" type="button">
                  <span className="material-symbols-rounded text-[18px]">badge</span>
                  <span className="flex-1">친구가 나를 찾을 수 있게 아이디를 정해 주세요</span>
                  <span className="material-symbols-rounded text-[18px]">chevron_right</span>
                </button>
              )}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => navigate('/friends')}
                  className="relative h-10 rounded-lg fill-neutral text-on-surface text-label-md font-semibold flex items-center justify-center gap-1.5 pressable"
                  type="button"
                >
                  친구 {friendCount}
                  {requestCount > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-error text-on-error text-[11px] font-bold leading-[18px] text-center">
                      {requestCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => navigate('/profile')}
                  className="h-10 rounded-lg fill-neutral text-on-surface text-label-md font-semibold flex items-center justify-center pressable"
                  type="button"
                >
                  프로필 편집
                </button>
              </div>
            </section>
            <MyTownCard capsules={capsules} />
            <div className="flex border-b border-gray-200">
              {tabButton('mine', '내 영상', mine.length)}
              {tabButton('tagged', '태그된 영상', tagged.length)}
            </div>
          </>
        ) : (
          <>
            <MyTownCard capsules={capsules} />
            <div className="row-x pt-5 pb-3 border-b border-gray-200">
              <div className="flex items-baseline justify-between">
                <h2 className="text-headline-sm text-on-surface">내 영상</h2>
                <span className="text-label-md text-on-surface-variant">{capsules.length}개</span>
              </div>
              <p className="text-label-sm text-on-surface-variant">영상은 이 기기 브라우저에만 저장돼요.</p>
            </div>
          </>
        )}

        {shown.length === 0 ? (
          <div className="row-x flex flex-col items-center text-center py-14 text-on-surface-variant border-b border-gray-200">
            <span className="material-symbols-rounded text-[28px] text-gray-400">{tab === 'mine' ? 'videocam' : 'sell'}</span>
            <p className="mt-2 text-body-md">{tab === 'mine' ? '아직 남긴 영상이 없어요.' : '친구가 나를 태그한 영상이 여기에 모여요.'}</p>
            {tab === 'mine' && (
              <button onClick={() => navigate('/leave')} className="mt-5 h-11 px-5 rounded-lg fill-accent text-white text-label-lg font-bold pressable" type="button">
                첫 5초 남기기
              </button>
            )}
          </div>
        ) : (
          // 프로필 격자: 썸네일끼리 얇은 흰 간격으로 붙여 하나의 면처럼
          <div className="grid grid-cols-3 gap-0.5 border-b border-gray-200">
            {shown.map((c) => (
              <CapsuleCard key={c.id} capsule={c} showAuthor={tab === 'tagged'} onOpen={() => navigate(`/video/${c.id}`)} />
            ))}
          </div>
        )}
      </div>

      <button onClick={() => navigate('/privacy')} className="mt-10 self-center text-label-sm text-gray-400 underline underline-offset-2" type="button">
        개인정보처리방침
      </button>
    </div>
  );
}

function CapsuleCard({ capsule: c, showAuthor, onOpen }: { capsule: Capsule; showAuthor: boolean; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="flex flex-col text-left bg-white active:opacity-80" type="button" aria-label={`${c.placeName}, ${formatDate(c.createdAt)}`}>
      <div className="relative w-full aspect-[3/4] bg-gray-100">
        <CapsuleThumb thumbnail={c.thumbnail} />
        <span className="absolute top-1.5 right-1.5 px-1 rounded bg-white text-gray-800 text-[11px] font-semibold leading-[18px] flex items-center">
          {Math.round(c.clipDuration)}초
        </span>
        {showAuthor && c.author && <Avatar profile={c.author} size={24} className="absolute top-1.5 left-1.5 ring-2 ring-white" />}
      </div>
      <div className="px-2 py-1.5">
        <p className="text-label-md text-on-surface font-semibold truncate">{c.placeName}</p>
        <p className="text-[11px] text-on-surface-variant truncate">
          {showAuthor && c.author ? `${c.author.displayName} · ` : ''}
          {formatDate(c.createdAt)}
          {c.tags.length > 0 ? ` · ${c.tags.length}명` : ''}
        </p>
      </div>
    </button>
  );
}
