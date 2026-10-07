export interface Profile {
  id: string;
  /** 영문 아이디 (@태그에 쓰임) */
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

/** 나와의 관계: 친구 / 내가 보낸 요청 / 받은 요청 / 관계 없음 */
export type FriendStatus = 'friend' | 'outgoing' | 'incoming' | 'none';

export interface ProfileWithStatus extends Profile {
  status: FriendStatus;
}

/** 같이 간 친구가 보낸 조르기 ("여기 또 가자") */
export interface Nudge {
  id: string;
  /** 보낸 친구. 더 이상 볼 수 없는 사람이면 null */
  sender: Profile | null;
  /** 같이 남긴 영상. 지워졌으면 null */
  capsuleId: string | null;
  placeId: string;
  placeName: string;
  createdAt: number;
  read: boolean;
}
