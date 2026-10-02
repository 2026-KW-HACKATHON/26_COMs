import type { Profile } from './social';

// 장소에 남기는 기억은 "5초 영상" 하나다.
export const CLIP_SECONDS = 5;

/** 기기 저장(IndexedDB)은 파일(Blob) 그대로, 서버 저장은 재생용 URL */
export type Media = Blob | string;

export interface Capsule {
  id: string;
  /** 작성자 id. 기기 저장은 계정이 없어서 빈 문자열 */
  userId: string;
  /** 작성자 프로필 (서버 저장일 때만) */
  author: Profile | null;
  /** 함께 태그된 친구 */
  tags: Profile[];
  placeId: string;
  /** 장소 데이터가 갱신돼도 기록이 깨지지 않도록 이름과 좌표를 함께 저장 */
  placeName: string;
  lat: number;
  lng: number;
  /** 원본 영상. 앨범 영상이 5초보다 길면 clipStart부터 clipDuration만큼만 재생한다. */
  video: Media;
  clipStart: number;
  clipDuration: number;
  /** 목록·지도용 썸네일 (JPEG) */
  thumbnail: Media | null;
  createdAt: number;
}

/** 새로 남길 기록. 저장 전이라 영상·썸네일은 항상 파일이다. */
export interface NewCapsule {
  placeId: string;
  placeName: string;
  lat: number;
  lng: number;
  video: Blob;
  clipStart: number;
  clipDuration: number;
  thumbnail: Blob | null;
  /** 태그할 친구 id (서버 저장일 때만 쓰임) */
  tagIds: string[];
}
