import { groupColor } from '../lib/theme';
import type { GroupMember } from '../types/group';
import Avatar from './Avatar';

interface MemberAvatarProps {
  member: GroupMember;
  size?: number;
}

/** 그룹원 사진에 그 사람의 땅 색 테두리 (안쪽 흰 테두리가 패딩 절반을 덮어 바깥 2px만 색으로 보인다). 아직 수락하지 않은 사람은 흐리게 */
export default function MemberAvatar({ member, size = 36 }: MemberAvatarProps) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-full p-1 ${member.status === 'invited' ? 'opacity-50' : ''}`}
      style={{ background: groupColor(member.color).main }}
    >
      <Avatar profile={member} size={size} className="ring-2 ring-white" />
    </span>
  );
}

/** 그룹원 사진을 겹쳐서 몇 명까지 보여 준다 */
export function MemberStack({ members, size = 26, max = 5 }: { members: GroupMember[]; size?: number; max?: number }) {
  const rest = members.length - max;
  return (
    <span className="flex items-center -space-x-1.5">
      {members.slice(0, max).map((m) => (
        <MemberAvatar key={m.id} member={m} size={size} />
      ))}
      {rest > 0 && (
        <span className="pl-3 text-label-sm font-semibold text-on-surface-variant">+{rest}</span>
      )}
    </span>
  );
}
