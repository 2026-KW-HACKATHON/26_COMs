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
