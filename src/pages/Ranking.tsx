import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORY_EMOJI, placeSubtitle } from '../data/places';
import { usePlaceRanking } from '../hooks/usePlaceRanking';
import { DEFAULT_RANKING_DAYS, MEDALS, RANKING_PERIODS, type RankedPlace, type RankingDays } from '../lib/ranking';

/** 동네 랭킹: 5초 영상으로 남긴 방문이 많은 가게. 로그인하지 않아도 볼 수 있고 링크로 공유한다 */
export default function Ranking() {
  const navigate = useNavigate();
  const [days, setDays] = useState<RankingDays>(DEFAULT_RANKING_DAYS);
  const ranking = usePlaceRanking(days);
  const [note, setNote] = useState<string | null>(null);

  const flash = (text: string) => {
    setNote(text);
    setTimeout(() => setNote(null), 2000);
  };

  const share = async () => {
    const url = `${window.location.origin}/ranking`;
    const top = ranking?.[0];
    const text = top
      ? `월계1동 동네 랭킹 1위는 ${top.place.name}! 우리 동네 가게에 5초를 남겨 보세요`
      : '월계1동 가게에 5초를 남겨 보세요';
    try {
      if (navigator.share) {
        await navigator.share({ title: '왔다감 동네 랭킹', text, url });
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        flash('링크를 복사했어요');
      }
    } catch (err) {
      // 공유 창을 닫은 경우는 조용히 넘어간다
      if ((err as Error).name !== 'AbortError') flash('공유하지 못했어요');
    }
  };

  // 지도에서 그 가게를 선택한 채로 동네 지도를 연다
  const openOnMap = (r: RankedPlace) => navigate('/?view=town', { state: { placeId: r.placeId } });

  return (
    <div className="flex flex-col w-full pb-8">
      <div className="bleed">
        <section className="row-x pt-5 pb-4">
          <p className="text-label-md font-semibold text-primary">노원구 월계1동</p>
          <h2 className="mt-0.5 text-headline-sm text-on-surface">동네 사람들이 다시 찾는 가게</h2>
          <p className="mt-1 text-body-sm text-on-surface-variant">5초를 남긴 방문이 많은 순서예요. 다시 찾아갈수록 순위가 올라가요.</p>
        </section>

        <div className="flex border-y border-gray-200" role="tablist" aria-label="기간">
          {RANKING_PERIODS.map((p) => (
            <button
              key={p.label}
              onClick={() => setDays(p.days)}
              className={`flex-1 h-12 -mb-px border-b-2 text-label-lg transition-colors ${
                days === p.days ? 'border-on-surface text-on-surface font-bold' : 'border-transparent text-gray-500 font-medium'
              }`}
              type="button"
              role="tab"
              aria-selected={days === p.days}
            >
              {p.label}
            </button>
          ))}
        </div>

        {ranking === null ? (
          <ul className="flex flex-col divide-y divide-gray-200 border-b border-gray-200" aria-label="불러오는 중">
            {[0, 1, 2, 3, 4].map((i) => (
              <li key={i} className="row-x flex items-center gap-3 py-3.5 animate-pulse">
                <span className="w-6 h-5 rounded bg-gray-100" />
                <span className="flex-1 flex flex-col gap-1.5">
                  <span className="w-2/3 h-4 rounded bg-gray-100" />
                  <span className="w-1/3 h-3 rounded bg-gray-100" />
                </span>
              </li>
            ))}
          </ul>
        ) : ranking.length === 0 ? (
          <div className="row-x flex flex-col items-center text-center py-14 text-on-surface-variant border-b border-gray-200">
            <span className="text-[26px]">🏆</span>
            <p className="mt-2 text-body-md">
              {days === null ? '아직 다녀간 사람이 없어요.' : `${RANKING_PERIODS.find((p) => p.days === days)?.label} 동안 다녀간 사람이 없어요.`}
              <br />첫 번째 단골이 되어 보세요!
            </p>
          </div>
        ) : (
          <ol className="flex flex-col divide-y divide-gray-200 border-b border-gray-200">
            {ranking.map((r) => (
              <li key={r.placeId}>
                <button onClick={() => openOnMap(r)} className="row-x w-full flex items-center gap-3 py-3.5 text-left active:bg-gray-50" type="button">
                  <span className={`w-6 shrink-0 text-center ${r.rank <= 3 ? 'text-[20px] leading-none' : 'text-label-lg font-bold text-gray-400'}`}>
                    {MEDALS[r.rank - 1] ?? r.rank}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-label-lg font-bold text-on-surface truncate">
                      <span className="mr-1 font-normal">{CATEGORY_EMOJI[r.place.category] ?? '📍'}</span>
                      {r.place.name}
                    </span>
                    <span className="block text-label-sm text-on-surface-variant truncate">
                      {[placeSubtitle(r.place), `${r.people}명이 다녀갔어요`, r.regulars > 0 && `단골 ${r.regulars}명`].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="shrink-0 text-[16px] font-bold text-on-surface tabular-nums">
                    {r.visits}
                    <span className="text-label-sm font-medium text-on-surface-variant"> 번</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      <p className="mt-4 text-label-sm text-on-surface-variant">
        영상에 나온 사람(태그된 친구 포함)이 그날 다녀간 것을 방문 한 번으로 세요. 같은 날 여러 개를 남겨도 한 번이고, 단골은 다른 날 두 번 이상 온
        사람이에요. 영상과 누가 남겼는지는 공개되지 않아요.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button onClick={share} className="h-11 rounded-lg fill-neutral text-gray-700 text-label-lg flex items-center justify-center gap-1.5 pressable" type="button">
          <span className="material-symbols-rounded text-[20px] text-gray-500">ios_share</span>
          랭킹 공유하기
        </button>
        <button onClick={() => navigate('/leave')} className="h-11 rounded-lg fill-accent text-white text-label-lg font-bold flex items-center justify-center gap-1.5 pressable" type="button">
          <span className="material-symbols-rounded text-[20px]">videocam</span>
          5초 남기기
        </button>
      </div>
      {note && <p className="mt-3 text-center text-label-md text-on-surface-variant" role="status">{note}</p>}
    </div>
  );
}
