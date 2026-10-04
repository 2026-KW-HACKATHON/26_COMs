import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from '../components/Avatar';
import CapsuleThumb from '../components/CapsuleThumb';
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
      className={`flex-1 h-10 border-b-2 font-label-lg text-label-lg transition-colors ${
        tab === value ? 'border-primary text-primary font-bold' : 'border-transparent text-on-surface-variant'
      }`}
      type="button"
      aria-pressed={tab === value}
    >
      {label} {count}
    </button>
  );

  return (
    <div className="flex flex-col w-full pb-6 pt-3">
      {SOCIAL_ENABLED ? (
        <>
          <section className="flex items-center gap-3 mb-4">
            <Avatar profile={profile} size={64} />
            <div className="flex-1 min-w-0">
              <h2 className="font-headline-md text-headline-md text-on-surface truncate">{profile?.displayName ?? '나'}</h2>
              {profile && <p className="font-label-md text-label-md text-on-surface-variant truncate">@{profile.username}</p>}
            </div>
          </section>
          {profile && isAutoUsername(profile.username) && (
            <button
              onClick={() => navigate('/profile')}
              className="mb-4 w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-primary-fixed/50 text-on-primary-fixed text-left"
              type="button"
            >
              <span className="material-symbols-outlined text-[20px] text-primary">badge</span>
              <span className="flex-1 font-label-md text-label-md">친구가 나를 찾을 수 있게 아이디를 정해 주세요</span>
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          )}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={() => navigate('/friends')}
              className="relative h-11 rounded-xl bg-surface-container-low text-on-surface font-label-lg text-label-lg flex items-center justify-center gap-1.5"
              type="button"
            >
              <span className="material-symbols-outlined text-[20px] text-primary">group</span>
              친구 {friendCount}
              {requestCount > 0 && (
                <span className="absolute top-1.5 right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-error text-on-error text-[11px] font-bold leading-[18px] text-center">
                  {requestCount}
                </span>
              )}
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="h-11 rounded-xl bg-surface-container-low text-on-surface font-label-lg text-label-lg flex items-center justify-center gap-1.5"
              type="button"
            >
              <span className="material-symbols-outlined text-[20px] text-primary">edit</span>
              프로필 편집
            </button>
          </div>
          <div className="flex mb-3">
            {tabButton('mine', '내 영상', mine.length)}
            {tabButton('tagged', '태그된 영상', tagged.length)}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-headline-md text-headline-md text-on-surface">내 영상</h2>
            <span className="font-label-md text-label-md text-on-surface-variant">{capsules.length}개</span>
          </div>
          <p className="-mt-1 mb-3 font-label-sm text-label-sm text-on-surface-variant">영상은 이 기기 브라우저에만 저장돼요.</p>
        </>
      )}

      {shown.length === 0 ? (
        <div className="flex flex-col items-center text-center py-14 px-6 rounded-2xl bg-surface-container-low text-on-surface-variant">
          <span className="material-symbols-outlined text-[40px] opacity-60">{tab === 'mine' ? 'videocam' : 'sell'}</span>
          <p className="mt-2 font-body-md text-body-md">{tab === 'mine' ? '아직 남긴 영상이 없어요.' : '친구가 나를 태그한 영상이 여기에 모여요.'}</p>
          {tab === 'mine' && (
            <button onClick={() => navigate('/leave')} className="mt-4 px-5 py-2.5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg shadow-sm" type="button">
              첫 영상 남기기
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {shown.map((c) => (
            <CapsuleCard key={c.id} capsule={c} showAuthor={tab === 'tagged'} onOpen={() => navigate(`/video/${c.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

function CapsuleCard({ capsule: c, showAuthor, onOpen }: { capsule: Capsule; showAuthor: boolean; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="flex flex-col text-left rounded-2xl overflow-hidden bg-surface-container-lowest shadow-sm active:scale-[0.98] transition-transform" type="button">
      <div className="relative w-full aspect-[3/4] bg-surface-container-high">
        <CapsuleThumb thumbnail={c.thumbnail} />
        <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-full bg-black/50 text-white font-label-sm text-[11px] flex items-center gap-0.5">
          <span className="material-symbols-outlined text-[12px]">play_arrow</span>
          {Math.round(c.clipDuration)}초
        </span>
        {c.tags.length > 0 && (
          <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-full bg-black/50 text-white font-label-sm text-[11px] flex items-center gap-0.5">
            <span className="material-symbols-outlined text-[12px]">group</span>
            {c.tags.length}
          </span>
        )}
        {showAuthor && c.author && <Avatar profile={c.author} size={28} className="absolute top-2 left-2 ring-2 ring-white" />}
      </div>
      <div className="px-2.5 py-2">
        <p className="font-label-lg text-label-lg text-on-surface font-bold truncate">{c.placeName}</p>
        <p className="font-label-sm text-label-sm text-on-surface-variant truncate">
          {showAuthor && c.author ? `${c.author.displayName} · ` : ''}
          {formatDate(c.createdAt)}
        </p>
      </div>
    </button>
  );
}
