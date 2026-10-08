import { useState } from 'react';
import { useGroups } from '../hooks/useGroups';
import { GROUP_SHARING_NOTE, acceptGroupInvite, leaveGroup } from '../lib/groups';
import type { Group } from '../types/group';
import { MemberStack } from './MemberAvatar';

interface GroupInviteCardProps {
  group: Group;
  me: string;
  /** 수락한 뒤 (그룹 목록이 새로 고쳐진 다음) */
  onAccepted?: () => void;
  onDeclined?: () => void;
}

/** 받은 그룹 초대: 누가 초대했고 누가 있는지 보고 참여하거나 거절한다 */
export default function GroupInviteCard({ group, me, onAccepted, onDeclined }: GroupInviteCardProps) {
  const { reload } = useGroups();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inviter = group.members.find((m) => m.id === group.members.find((x) => x.id === me)?.invitedBy);
  const members = group.members.filter((m) => m.status === 'member');

  const respond = async (accept: boolean) => {
    setBusy(true);
    setError('');
    try {
      if (accept) await acceptGroupInvite(group.id);
      else await leaveGroup(group.id);
      await reload();
      (accept ? onAccepted : onDeclined)?.();
    } catch (err) {
      console.error(err);
      setError(accept ? '참여하지 못했어요. 잠시 후 다시 시도해 주세요.' : '거절하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4 flat-card">
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 shrink-0 rounded-full bg-primary-fixed text-primary flex items-center justify-center">
          <span className="material-symbols-rounded icon-fill text-[22px]">groups</span>
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-label-lg font-bold text-on-surface truncate">{group.name}</span>
          <span className="block text-label-sm text-on-surface-variant truncate">
            {inviter ? `${inviter.displayName}님이 초대했어요` : '그룹 초대가 왔어요'} · 그룹원 {members.length}명
          </span>
        </span>
      </div>
      <MemberStack members={members} />
      <p className="text-label-sm text-on-surface-variant">참여하면 그룹원들과 한 지도에서 땅을 나눠 가져요. {GROUP_SHARING_NOTE}</p>
      {error && <p className="text-label-md text-error">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => respond(false)} disabled={busy} className="h-11 rounded-xl bg-gray-100 text-gray-700 text-label-lg pressable disabled:opacity-50" type="button">
          거절
        </button>
        <button onClick={() => respond(true)} disabled={busy} className="h-11 rounded-xl bg-primary text-on-primary text-label-lg font-bold pressable disabled:opacity-50" type="button">
          참여하기
        </button>
      </div>
    </div>
  );
}
