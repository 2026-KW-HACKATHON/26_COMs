import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import FriendChecklist from '../components/FriendChecklist';
import GroupInviteCard from '../components/GroupInviteCard';
import MemberAvatar from '../components/MemberAvatar';
import PlaceMap, { type PlaceOwner } from '../components/PlaceMap';
import { CATEGORY_EMOJI, getPlace, placeSubtitle } from '../data/places';
import { useAuth } from '../hooks/useAuth';
import { useFriendships } from '../hooks/useFriendships';
import { useGroupMap } from '../hooks/useGroupMap';
import { useGroups } from '../hooks/useGroups';
import { GROUP_MAX, GroupFullError, MEDALS, cancelGroupInvite, computeTerritory, inviteToGroup, leaveGroup, memberBadge } from '../lib/groups';
import { groupColor } from '../lib/theme';
import type { Group } from '../types/group';

/** 그룹 화면: 초대받았으면 참여·거절, 그룹원이면 그룹 지도와 그룹원 순위 */
export default function GroupDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const me = useAuth().session?.user.id ?? '';
  const { list } = useGroups();
  const group = list?.find((g) => g.id === id) ?? null;

  if (list === null) return <p className="py-10 text-center text-body-md text-on-surface-variant">그룹을 불러오는 중…</p>;
  if (!group) {
    return (
      <div className="flex flex-col items-center gap-4 py-14 text-center">
        <p className="text-body-md text-on-surface-variant">그룹을 찾을 수 없어요. 나갔거나 지워진 그룹이에요.</p>
        <button onClick={() => navigate('/groups', { replace: true })} className="h-11 px-5 rounded-xl bg-gray-100 text-gray-700 text-label-lg pressable" type="button">
          그룹 목록으로
        </button>
      </div>
    );
  }
  if (group.myStatus === 'invited') {
    // 수락하면 그룹 목록이 새로 고쳐지면서 바로 그룹 지도로 바뀐다
    return (
      <div className="pt-4">
        <GroupInviteCard group={group} me={me} onDeclined={() => navigate('/groups', { replace: true })} />
      </div>
    );
  }
  return <GroupBoard key={group.id} group={group} me={me} />;
}

const secondaryButton = 'h-8 px-3 rounded-full bg-gray-100 text-gray-700 text-label-md font-semibold pressable disabled:opacity-50';

function GroupBoard({ group, me }: { group: Group; me: string }) {
  const navigate = useNavigate();
  const { reload } = useGroups();
  const { list: friendships } = useFriendships();
  const members = useMemo(() => group.members.filter((m) => m.status === 'member'), [group]);
  const invited = group.members.filter((m) => m.status === 'invited');
  const memberOf = useMemo(() => new Map(group.members.map((m) => [m.id, m])), [group]);
  // 그룹원이 바뀌면 지도를 다시 받는다
  const visits = useGroupMap(group.id, members.map((m) => m.id).join(','));
  const territory = useMemo(() => computeTerritory(visits ?? [], group.members), [visits, group]);

  // 순위에서 그룹원을 누르면 그 사람의 땅만 지도에 보여 준다
  const [focusId, setFocusId] = useState<string | null>(null);
  const focus = focusId ? memberOf.get(focusId) : undefined;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 지도: 가게마다 땅 주인의 색, 말풍선에 주인 이름 첫 글자. 진하기(빛 번짐)는 주인의 방문 수
  const { videoCount, owners } = useMemo(() => {
    const videoCount = new Map<string, number>();
    const owners = new Map<string, PlaceOwner>();
    for (const [placeId, o] of territory.owners) {
      const m = memberOf.get(o.userId);
      if (!m || (focus && focus.id !== m.id)) continue;
      videoCount.set(placeId, o.visits);
      owners.set(placeId, { color: groupColor(m.color), badge: memberBadge(m) });
    }
    return { videoCount, owners };
  }, [territory, memberOf, focus]);
  // 지도는 칠해진 땅(한 명만 보면 그 사람의 땅)이 모두 보이게 맞춘다
  const landIds = useMemo(() => [...owners.keys()].sort(), [owners]);

  const selected = getPlace(selectedId);
  const placeVisits = selectedId ? (territory.byPlace.get(selectedId) ?? []) : [];
  const owner = selectedId ? territory.owners.get(selectedId) : undefined;
  const myVisits = placeVisits.find((v) => v.userId === me)?.visits ?? 0;
  // 같은 횟수면 먼저 차지한 사람이 지키므로 주인보다 한 번 더 가야 한다
  const need = owner?.userId === me ? 0 : (owner?.visits ?? 0) + 1 - myVisits;

  // 친구 초대
  const [inviting, setInviting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const slots = GROUP_MAX - group.members.length;
  const invitable = useMemo(() => {
    if (friendships === null) return null;
    const inGroup = new Set(group.members.map((m) => m.id));
    return friendships.filter((f) => f.status === 'friend' && !inGroup.has(f.id));
  }, [friendships, group]);

  const run = async (action: () => Promise<unknown>, failText: string) => {
    setBusy(true);
    setError('');
    try {
      await action();
      return true;
    } catch (err) {
      console.error(err);
      setError(err instanceof GroupFullError ? `그룹은 ${GROUP_MAX}명까지예요 (초대 중인 사람 포함).` : failText);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const sendInvites = async () => {
    const ok = await run(async () => {
      await inviteToGroup(group.id, picked);
      await reload();
    }, '초대하지 못했어요. 잠시 후 다시 시도해 주세요.');
    if (ok) {
      setPicked([]);
      setInviting(false);
    }
  };

  const cancelInvite = (userId: string) =>
    run(async () => {
      await cancelGroupInvite(group.id, userId);
      await reload();
    }, '초대를 취소하지 못했어요. 잠시 후 다시 시도해 주세요.');

  const leave = async () => {
    const last = members.length === 1;
    const question = last
      ? `'${group.name}'의 마지막 그룹원이에요. 나가면 그룹이 지워져요.`
      : `'${group.name}'에서 나갈까요? 내 땅이 그룹 지도에서 사라져요.`;
    if (!confirm(question)) return;
    const ok = await run(() => leaveGroup(group.id), '그룹에서 나가지 못했어요. 잠시 후 다시 시도해 주세요.');
    if (ok) {
      navigate('/groups', { replace: true });
      void reload();
    }
  };

  const nameOf = (userId: string) => (userId === me ? '나' : (memberOf.get(userId)?.displayName ?? '그룹원'));
  const anyLand = territory.standings.some((s) => s.places > 0);

  return (
    <div className="flex flex-col w-full pt-3 pb-8 gap-5">
      <section className="px-1">
        <h2 className="text-headline-md text-on-surface truncate">{group.name}</h2>
        <p className="text-body-sm text-on-surface-variant">가게마다 가장 많이 간 그룹원의 색으로 칠해져요.</p>
      </section>

      <div className="relative h-[55vh] min-h-[300px] max-h-[520px] rounded-3xl overflow-hidden bg-gray-100">
        <PlaceMap selectedId={selectedId} onSelect={(p) => setSelectedId(p.id)} videoCount={videoCount} owners={owners} fitPlaceIds={landIds} showMyLocation={false} className="absolute inset-0" />

        {focus && (
          <button
            onClick={() => setFocusId(null)}
            className="absolute top-3 left-3 z-10 max-w-[calc(100%-1.5rem)] h-9 pl-1 pr-2 rounded-full bg-surface shadow-float flex items-center gap-1.5 text-label-md font-semibold text-gray-700 pressable"
            type="button"
          >
            <MemberAvatar member={focus} size={24} />
            <span className="truncate">{focus.id === me ? '내' : `${focus.displayName}님의`} 땅만 보는 중</span>
            <span className="material-symbols-rounded text-[18px] text-gray-400">close</span>
          </button>
        )}

        {selected && (
          <div className="absolute bottom-3 inset-x-3 z-10 bg-surface rounded-2xl p-4 shadow-sheet flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 shrink-0 rounded-full bg-surface-container flex items-center justify-center text-[20px]">
                {CATEGORY_EMOJI[selected.category] ?? '📍'}
              </span>
              <div className="flex-1 min-w-0">
                <h3 className="text-label-lg font-bold text-on-surface truncate">{selected.name}</h3>
                <p className="text-label-sm text-on-surface-variant truncate">{placeSubtitle(selected)}</p>
              </div>
              <button onClick={() => setSelectedId(null)} className="w-8 h-8 shrink-0 rounded-full bg-surface-container text-gray-500 flex items-center justify-center pressable" type="button" aria-label="닫기">
                <span className="material-symbols-rounded text-[20px]">close</span>
              </button>
            </div>

            {placeVisits.length > 0 && (
              <ul className="flex flex-col gap-1">
                {placeVisits.slice(0, 3).map((v) => (
                  <li key={v.userId} className="flex items-center gap-2 text-label-md">
                    <span className="w-2.5 h-2.5 shrink-0 rounded-full" style={{ background: groupColor(memberOf.get(v.userId)?.color ?? 0).main }} />
                    <span className={`flex-1 min-w-0 truncate ${v.owner ? 'font-bold text-on-surface' : 'text-on-surface-variant'}`}>
                      {nameOf(v.userId)}
                      {v.owner && ' · 땅 주인'}
                    </span>
                    <span className="shrink-0 font-semibold text-on-surface">{v.visits}번</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-label-md font-semibold text-on-primary-fixed">
              {need === 0 ? '내 땅이에요! 다른 날 또 가면 더 지키기 쉬워요' : `${placeVisits.length ? `${need}번 더 가면` : '처음 가면'} 내 땅이 돼요 (같은 날은 한 번만 세요)`}
            </p>
            <button
              onClick={() => navigate(`/leave?place=${encodeURIComponent(selected.id)}`)}
              className="h-11 rounded-xl bg-primary text-on-primary text-label-lg font-bold flex items-center justify-center gap-1.5 pressable"
              type="button"
            >
              <span className="material-symbols-rounded text-[20px]">videocam</span>
              여기에 5초 남기기
            </button>
          </div>
        )}
      </div>

      <section>
        <div className="flex items-baseline justify-between px-1">
          <h3 className="text-headline-sm text-on-surface">그룹원 순위</h3>
          <span className="text-label-sm text-on-surface-variant">땅 많은 순</span>
        </div>
        {visits === null ? (
          <ul className="flex flex-col" aria-label="불러오는 중">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-1 py-3 animate-pulse">
                <span className="w-7 h-5 rounded-full bg-gray-100" />
                <span className="w-11 h-11 rounded-full bg-gray-100" />
                <span className="flex-1 h-4 rounded-full bg-gray-100" />
              </li>
            ))}
          </ul>
        ) : (
          <ol className="mt-1 flex flex-col">
            {territory.standings.map((s) => {
              const on = focusId === s.member.id;
              return (
                <li key={s.member.id}>
                  <button
                    onClick={() => setFocusId(on ? null : s.member.id)}
                    className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-2xl text-left pressable ${on ? 'bg-gray-100' : ''}`}
                    type="button"
                    aria-pressed={on}
                  >
                    <span className={`w-7 shrink-0 text-center ${s.places > 0 && s.rank <= 3 ? 'text-[22px] leading-none' : 'text-label-lg font-bold text-gray-500'}`}>
                      {s.places > 0 ? (MEDALS[s.rank - 1] ?? s.rank) : '–'}
                    </span>
                    <MemberAvatar member={s.member} size={40} />
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1 text-label-lg font-bold text-on-surface">
                        <span className="truncate">{s.member.displayName}</span>
                        {s.member.id === me && <span className="shrink-0 px-1.5 rounded-full bg-primary-fixed text-on-primary-fixed text-[11px] leading-[18px]">나</span>}
                      </span>
                      <span className="block text-label-sm text-on-surface-variant truncate">{s.visits ? `가게 방문 ${s.visits}번` : '아직 방문 없음'}</span>
                    </span>
                    <span className="shrink-0 flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full" style={{ background: groupColor(s.member.color).main }} />
                      <span className="text-[17px] font-bold leading-tight text-on-surface">
                        {s.places}
                        <span className="text-label-sm font-semibold text-on-surface-variant">곳</span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
        {visits !== null && !anyLand && (
          <p className="mt-2 px-1 text-label-md text-on-surface-variant">아직 칠해진 땅이 없어요. 가게에 5초를 남겨 첫 땅을 차지해 보세요!</p>
        )}
        <p className="mt-3 px-1 text-label-sm text-on-surface-variant">
          땅은 그 가게에 가장 많이 간 그룹원 차지예요. 영상에 나온 날(태그 포함)을 방문 한 번으로 세고, 같은 날 여러 개를 남겨도 한 번이에요. 횟수가 같으면
          먼저 차지한 사람이 지켜요.
        </p>
      </section>

      {invited.length > 0 && (
        <section>
          <h3 className="px-1 text-headline-sm text-on-surface">초대 중 {invited.length}</h3>
          <ul className="mt-1 divide-y divide-gray-100">
            {invited.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-1 py-2.5">
                <MemberAvatar member={m} size={36} />
                <span className="flex-1 min-w-0">
                  <span className="block text-label-lg font-bold text-on-surface truncate">{m.displayName}</span>
                  <span className="block text-label-sm text-on-surface-variant truncate">수락을 기다리는 중</span>
                </span>
                <button onClick={() => cancelInvite(m.id)} disabled={busy} className={secondaryButton} type="button">
                  초대 취소
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && <p className="text-label-md text-error">{error}</p>}

      {slots <= 0 ? (
        <p className="px-1 text-label-md text-on-surface-variant">그룹은 {GROUP_MAX}명까지예요 (초대 중인 사람 포함).</p>
      ) : inviting ? (
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between px-1">
            <h3 className="text-headline-sm text-on-surface">친구 초대</h3>
            <span className="text-label-md text-on-surface-variant">
              {picked.length}/{slots}명
            </span>
          </div>
          <FriendChecklist
            friends={invitable}
            selected={picked}
            onChange={setPicked}
            max={slots}
            emptyText="더 초대할 친구가 없어요. 같은 동네 친구를 추가해 보세요."
          />
          <div className="mt-1 grid grid-cols-2 gap-2">
            <button onClick={() => setInviting(false)} className="h-12 rounded-2xl bg-gray-100 text-gray-700 text-label-lg pressable" type="button">
              닫기
            </button>
            <button
              onClick={sendInvites}
              disabled={busy || picked.length === 0}
              className="h-12 rounded-2xl bg-primary text-on-primary text-label-lg font-bold pressable disabled:opacity-40"
              type="button"
            >
              {picked.length ? `${picked.length}명 초대하기` : '초대하기'}
            </button>
          </div>
        </section>
      ) : (
        <button onClick={() => setInviting(true)} className="h-12 rounded-2xl bg-gray-100 text-gray-700 text-label-lg flex items-center justify-center gap-1.5 pressable" type="button">
          <span className="material-symbols-rounded text-[20px] text-gray-500">person_add</span>
          친구 초대하기
        </button>
      )}

      <button onClick={leave} disabled={busy} className="mt-4 self-center text-label-md text-gray-400 underline underline-offset-2 disabled:opacity-50" type="button">
        그룹 나가기
      </button>
    </div>
  );
}
