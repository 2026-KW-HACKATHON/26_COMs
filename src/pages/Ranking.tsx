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
      ? `월계1동 동네 랭킹 1위는 ${top.place.name}! 우리 동네 단골 가게에서 5초 영상을 남겨 보세요`
      : '월계1동 단골 가게에서 5초 영상을 남겨 보세요';
    try {
      if (navigator.share) {
        await navigator.share({ title: '기억캡슐 동네 랭킹', text, url });
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
    <div className="flex flex-col w-full pt-4 pb-8 gap-4">
      <section className="app-card p-5">
        <p className="text-label-md font-bold text-primary">노원구 월계1동</p>
        <h2 className="text-headline-md text-on-surface">동네 사람들이 다시 찾는 가게</h2>
        <p className="mt-1 text-body-sm text-on-surface-variant">5초 영상으로 남긴 방문이 많은 순서예요. 다시 찾아갈수록 순위가 올라가요.</p>
      </section>

      <div className="flex p-1 rounded-full bg-white border border-gray-100 shadow-[0_10px_24px_rgba(15,23,42,0.06)]" role="tablist" aria-label="기간">
        {RANKING_PERIODS.map((p) => (
          <button
            key={p.label}
            onClick={() => setDays(p.days)}
            className={`flex-1 h-10 rounded-full text-label-md font-semibold transition-all ${
              days === p.days ? 'bg-white text-on-surface shadow-[0_8px_22px_rgba(15,23,42,0.08)]' : 'text-gray-500'
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
        <ul className="flex flex-col app-card p-4" aria-label="불러오는 중">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="flex items-center gap-3 py-3 animate-pulse">
              <span className="w-7 h-5 rounded-full bg-gray-100" />
              <span className="w-11 h-11 rounded-full bg-gray-100" />
              <span className="flex-1 flex flex-col gap-1.5">
                <span className="w-2/3 h-4 rounded-full bg-gray-100" />
                <span className="w-1/3 h-3 rounded-full bg-gray-100" />
              </span>
            </li>
          ))}
        </ul>
      ) : ranking.length === 0 ? (
        <div className="mt-2 flex flex-col items-center text-center py-14 px-6 app-card text-on-surface-variant">
          <div className="w-16 h-16 rounded-full instagram-gradient flex items-center justify-center text-white shadow-[0_16px_30px_rgba(225,48,108,0.24)]">
            <span className="text-[30px]">🏆</span>
          </div>
          <p className="mt-2 text-body-md">
            {days === null ? '아직 남긴 기록이 없어요.' : `${RANKING_PERIODS.find((p) => p.days === days)?.label} 동안 남긴 기록이 없어요.`}
            <br />첫 번째 단골이 되어 보세요!
          </p>
        </div>
      ) : (
        <ol className="flex flex-col">
          {ranking.map((r) => (
            <li key={r.placeId} className="app-card mb-3 overflow-hidden">
              <button onClick={() => openOnMap(r)} className="w-full flex items-center gap-3 p-4 text-left pressable" type="button">
                <span className={`w-7 shrink-0 text-center ${r.rank <= 3 ? 'text-[24px] leading-none' : 'text-label-lg font-bold text-gray-500'}`}>
                  {MEDALS[r.rank - 1] ?? r.rank}
                </span>
                <span className="w-11 h-11 shrink-0 rounded-full bg-gray-100 border border-gray-100 flex items-center justify-center text-[22px]">
                  {CATEGORY_EMOJI[r.place.category] ?? '📍'}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-label-lg font-bold text-on-surface truncate">{r.place.name}</span>
                  <span className="block text-label-sm text-on-surface-variant truncate">
                    {[placeSubtitle(r.place), `${r.people}명이 다녀갔어요`, r.verifiedVisits > 0 && `현장 인증 ${r.verifiedVisits}번`].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="shrink-0 flex flex-col items-end">
                  <span className="text-[17px] font-bold leading-tight text-primary">
                    {r.visits}
                    <span className="text-label-sm font-semibold"> 번</span>
                  </span>
                  {r.regulars > 0 && (
                    <span className="mt-0.5 px-1.5 rounded-full instagram-gradient text-white text-[11px] font-bold leading-[18px]">단골 {r.regulars}명</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-4 text-label-sm text-on-surface-variant">
        영상에 나온 사람(태그된 친구 포함)이 그날 다녀간 것을 방문 한 번으로 세요. 같은 날 여러 개를 남겨도 한 번이고, 단골은 다른 날 두 번 이상 온
        사람이에요. 현장 인증은 앱에서 촬영할 때 가게에서 100m 안이었던 방문이에요. 영상과 누가 남겼는지는 공개되지 않아요.
      </p>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button onClick={share} className="h-12 rounded-full bg-white border border-gray-100 text-gray-700 text-label-lg flex items-center justify-center gap-1.5 pressable shadow-[0_10px_22px_rgba(15,23,42,0.05)]" type="button">
          <span className="material-symbols-rounded text-[20px] text-gray-500">ios_share</span>
          랭킹 공유하기
        </button>
        <button onClick={() => navigate('/leave')} className="h-12 rounded-full instagram-gradient text-white text-label-lg font-bold flex items-center justify-center gap-1.5 pressable shadow-[0_12px_24px_rgba(225,48,108,0.26)]" type="button">
          <span className="material-symbols-rounded text-[20px]">videocam</span>
          5초 남기기
        </button>
      </div>
      {note && <p className="mt-3 text-center text-label-md text-on-surface-variant" role="status">{note}</p>}
    </div>
  );
}
