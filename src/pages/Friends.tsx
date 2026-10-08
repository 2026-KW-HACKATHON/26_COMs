import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from '../components/Avatar';
import { useAuth } from '../hooks/useAuth';
import { useFriendships } from '../hooks/useFriendships';
import { isAutoUsername, removeFriend, requestFriend, searchProfiles } from '../lib/social';
import type { FriendStatus, ProfileWithStatus } from '../types/social';

function PersonRow({ person, children }: { person: ProfileWithStatus; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <Avatar profile={person} size={44} />
      <div className="flex-1 min-w-0">
        <p className="text-label-lg text-on-surface font-bold truncate">{person.displayName}</p>
        <p className="text-label-sm text-on-surface-variant truncate">@{person.username}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">{children}</div>
    </li>
  );
}

const primaryButton = 'h-9 px-3.5 rounded-full instagram-gradient text-white text-label-md font-bold pressable disabled:opacity-50 shadow-[0_10px_20px_rgba(225,48,108,0.18)]';
const secondaryButton = 'h-9 px-3.5 rounded-full bg-white border border-gray-200 text-gray-700 text-label-md font-semibold pressable disabled:opacity-50';

export default function Friends() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { list, reload } = useFriendships();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ q: string; list: ProfileWithStatus[] } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<'done' | 'failed' | null>(null);

  const q = query.trim();
  const searching = q.replace(/^@/, '').length >= 2;

  useEffect(() => {
    if (!searching) return;
    let alive = true;
    // 입력이 멈추면 검색
    const timer = setTimeout(() => {
      searchProfiles(q)
        .then((found) => alive && setResults({ q, list: found }))
        .catch((err) => {
          console.error(err);
          if (alive) setResults({ q, list: [] });
        });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [q, searching]);

  const act = async (person: ProfileWithStatus, action: 'request' | 'remove') => {
    if (action === 'remove' && person.status === 'friend' && !confirm(`${person.displayName}님과 친구를 끊을까요? 서로의 지도를 더 이상 볼 수 없어요.`)) return;
    setBusyId(person.id);
    setError('');
    try {
      let status: FriendStatus = 'none';
      if (action === 'request') status = await requestFriend(person.id);
      else await removeFriend(person.id);
      setResults((r) => r && { ...r, list: r.list.map((p) => (p.id === person.id ? { ...p, status } : p)) });
      reload();
    } catch (err) {
      console.error(err);
      const what =
        action === 'request'
          ? person.status === 'incoming'
            ? '친구 요청을 수락하지'
            : '친구 요청을 보내지'
          : person.status === 'friend'
            ? '친구를 끊지'
            : person.status === 'incoming'
              ? '요청을 거절하지'
              : '요청을 취소하지';
      setError(`${what} 못했어요. 잠시 후 다시 시도해 주세요.`);
    } finally {
      setBusyId(null);
    }
  };

  const copyMyId = async () => {
    if (!profile) return;
    const text = `@${profile.username}`;
    let ok: boolean;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      // 카카오톡 같은 앱 안 브라우저는 클립보드 API가 없을 때가 있어 예전 방식으로 한 번 더 시도한다
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      area.setSelectionRange(0, text.length);
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      area.remove();
    }
    setCopied(ok ? 'done' : 'failed');
    setTimeout(() => setCopied(null), 1500);
  };

  const actions = (person: ProfileWithStatus) => {
    const busy = busyId === person.id;
    switch (person.status) {
      case 'none':
        return <button onClick={() => act(person, 'request')} disabled={busy} className={primaryButton} type="button">친구 추가</button>;
      case 'outgoing':
        return <button onClick={() => act(person, 'remove')} disabled={busy} className={secondaryButton} type="button">요청 취소</button>;
      case 'incoming':
        return (
          <>
            <button onClick={() => act(person, 'request')} disabled={busy} className={primaryButton} type="button">수락</button>
            <button onClick={() => act(person, 'remove')} disabled={busy} className={secondaryButton} type="button">거절</button>
          </>
        );
      case 'friend':
        return (
          <>
            <button onClick={() => navigate(`/?user=${person.id}`)} className={secondaryButton} type="button">지도 보기</button>
            <button
              onClick={() => act(person, 'remove')}
              disabled={busy}
              className="w-9 h-9 rounded-lg bg-surface-container text-gray-500 flex items-center justify-center pressable disabled:opacity-50"
              type="button"
              aria-label={`${person.displayName}님과 친구 끊기`}
            >
              <span className="material-symbols-rounded text-[18px]">person_remove</span>
            </button>
          </>
        );
    }
  };

  const incoming = list?.filter((p) => p.status === 'incoming') ?? [];
  const friends = list?.filter((p) => p.status === 'friend') ?? [];
  const outgoing = list?.filter((p) => p.status === 'outgoing') ?? [];
  const shownResults = results?.q === q ? results.list : null;

  return (
    <div className="flex flex-col w-full pb-8 pt-3 gap-5">
      {profile && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-[28px] app-card">
          <span className="material-symbols-rounded text-gray-500 text-[22px]">badge</span>
          <div className="flex-1 min-w-0">
            <p className="text-label-sm text-on-surface-variant">내 아이디 (친구에게 알려 주세요)</p>
            {/* 복사가 안 되는 환경에서도 길게 눌러 직접 선택할 수 있게 버튼 밖에 둔다 */}
            <p className="text-label-lg text-on-surface font-bold truncate select-all">@{profile.username}</p>
          </div>
          {isAutoUsername(profile.username) ? (
            <button onClick={() => navigate('/profile')} className={primaryButton} type="button">아이디 정하기</button>
          ) : (
            <button onClick={copyMyId} className={secondaryButton} type="button">
              {copied === 'done' ? '복사됨' : copied === 'failed' ? '복사 실패' : '복사'}
            </button>
          )}
        </div>
      )}

      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2 px-4 h-12 rounded-full bg-white border border-gray-100 shadow-[0_10px_22px_rgba(15,23,42,0.05)]">
          <span className="material-symbols-rounded text-[22px] text-gray-400">search</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="아이디 또는 이름으로 친구 찾기"
            autoCapitalize="none"
            className="flex-1 min-w-0 bg-transparent outline-none text-[16px] text-on-surface placeholder:text-gray-400"
          />
          {query && (
            <button onClick={() => setQuery('')} className="w-7 h-7 flex items-center justify-center text-on-surface-variant" type="button" aria-label="지우기">
              <span className="material-symbols-rounded text-[18px]">close</span>
            </button>
          )}
        </div>
        {searching && (
          shownResults === null ? (
            <p className="px-1 text-label-md text-on-surface-variant">찾는 중…</p>
          ) : shownResults.length === 0 ? (
            <p className="px-1 text-label-md text-on-surface-variant">찾는 사람이 없어요. 아이디를 다시 확인해 주세요.</p>
          ) : (
            <ul className="px-1 divide-y divide-gray-100 bg-white border border-gray-100 rounded-[28px] overflow-hidden">
              {shownResults.map((p) => (
                <PersonRow key={p.id} person={p}>{actions(p)}</PersonRow>
              ))}
            </ul>
          )
        )}
        {query && !searching && <p className="px-1 text-label-md text-on-surface-variant">2글자 이상 입력해 주세요.</p>}
      </section>

      {error && <p className="text-label-md text-error">{error}</p>}

      {list === null ? (
        <p className="text-label-md text-on-surface-variant">친구 목록을 불러오는 중…</p>
      ) : (
        <>
          {incoming.length > 0 && (
            <section>
              <h2 className="text-headline-sm text-on-surface">받은 요청 {incoming.length}</h2>
              <ul className="divide-y divide-gray-100 bg-white border border-gray-100 rounded-[28px] overflow-hidden">
                {incoming.map((p) => (
                  <PersonRow key={p.id} person={p}>{actions(p)}</PersonRow>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="text-headline-sm text-on-surface">친구 {friends.length}</h2>
            {friends.length === 0 ? (
              <p className="mt-2 text-label-md text-on-surface-variant">친구를 추가하면 서로의 지도를 보고, 영상에 태그할 수 있어요.</p>
            ) : (
              <ul className="divide-y divide-gray-100 bg-white border border-gray-100 rounded-[28px] overflow-hidden">
                {friends.map((p) => (
                  <PersonRow key={p.id} person={p}>{actions(p)}</PersonRow>
                ))}
              </ul>
            )}
          </section>

          {outgoing.length > 0 && (
            <section>
              <h2 className="text-headline-sm text-on-surface">보낸 요청 {outgoing.length}</h2>
              <ul className="divide-y divide-gray-100 bg-white border border-gray-100 rounded-[28px] overflow-hidden">
                {outgoing.map((p) => (
                  <PersonRow key={p.id} person={p}>{actions(p)}</PersonRow>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
