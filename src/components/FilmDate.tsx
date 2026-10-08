import { formatFilmDate } from '../lib/format';

/** 필름 카메라가 사진 구석에 찍던 주황 날짜 ('26 10 08). 영상·썸네일 위 오른쪽 아래에 얹는다 (날짜는 화면에 따로 있어서 장식) */
export default function FilmDate({ at, className = '' }: { at: number; className?: string }) {
  return (
    <span className={`film-date absolute pointer-events-none ${className}`} aria-hidden>
      {formatFilmDate(at)}
    </span>
  );
}
