import type { Profile } from './social';

/** 그룹원(member) / 초대를 받고 아직 수락하지 않은 사람(invited) */
export type GroupMemberStatus = 'member' | 'invited';

export interface GroupMember extends Profile {
  status: GroupMemberStatus;
  /** 그룹 안에서 겹치지 않는 색 번호 (GROUP_COLORS) */
  color: number;
  /** 초대한 사람 id (만든 사람은 null) */
  invitedBy: string | null;
}

export interface Group {
  id: string;
  name: string;
  createdAt: number;
  /** 그룹원과 초대받은 사람 (색 번호 순) */
  members: GroupMember[];
  myStatus: GroupMemberStatus;
}

/** 그룹 지도의 한 줄: 한 그룹원이 한 가게에 간 횟수와 그 가게의 땅 주인인지 */
export interface GroupVisit {
  placeId: string;
  userId: string;
  /** 영상에 나온(작성자·태그) 날 수 */
  visits: number;
  owner: boolean;
}
