import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORY_EMOJI, getPlace } from '../data/places';
import { DUE_DAYS, REGULAR_DAYS, daysAgo, myPlaceVisits, summarizeVisits } from '../lib/visits';
import type { Capsule } from '../types/capsule';

/** MY 탭 위쪽: 동네 가게 중 몇 곳을 가 봤는지, 단골 수, 오래 안 간 곳 (내가 남겼거나 태그된 영상 기준) */
export default function MyTownCard({ capsules }: { capsules: Capsule[] }) {
  const navigate = useNavigate();
  const summary = useMemo(() => summarizeVisits(myPlaceVisits(capsules)), [capsules]);
  const ratio = summary.total ? summary.visited / summary.total : 0;
  const openOnMap = (placeId?: string) => navigate('/', placeId ? { state: { placeId } } : undefined);

  return (
    <div className="flex flex-col gap-3 mb-4">
      <button onClick={() => openOnMap()} className="w-full p-4 rounded-[28px] app-card text-left pressable" type="button">
        <span className="flex items-baseline justify-between">
          <span className="text-label-lg font-bold text-on-surface">내 동네 지도</span>
          <span className="text-label-md text-on-surface-variant">
            <b className="text-[17px] text-primary">{summary.visited}</b> / {summary.total}곳
          </span>
        </span>
        <span className="block mt-2 h-2 rounded-full bg-surface-container-high overflow-hidden">
          <span className="block h-full rounded-full bg-primary transition-[width]" style={{ width: `${summary.visited ? Math.max(2, ratio * 100) : 0}%` }} />
        </span>
        <span className="mt-2.5 flex flex-wrap items-center gap-1.5 text-label-sm font-semibold">
          <span className="h-6 px-2 rounded-full bg-surface flex items-center gap-0.5 text-gray-700">
            <span className="material-symbols-rounded icon-fill text-[14px] text-primary">star</span>단골 {summary.regulars}곳
          </span>
          {summary.due.length > 0 && <span className="h-6 px-2 rounded-full bg-surface flex items-center text-gray-700">오랜만 {summary.due.length}곳</span>}
          <span className="ml-auto text-gray-400 font-medium">다른 날 {REGULAR_DAYS}번 가면 단골</span>
        </span>
      </button>

      {summary.due.length > 0 && (
        <section className="p-4 rounded-[28px] glass border border-white/80 shadow-[0_14px_30px_rgba(90,100,160,0.06)]">
          <h3 className="text-label-lg font-bold text-on-surface">다시 갈 때 됐어요</h3>
          <p className="text-label-sm text-on-surface-variant">{DUE_DAYS}일 넘게 안 간 곳이에요</p>
          <ul className="mt-2 flex flex-col">
            {summary.due.slice(0, 3).map((v) => {
              const place = getPlace(v.placeId)!;
              return (
                <li key={v.placeId}>
                  <button onClick={() => openOnMap(v.placeId)} className="w-full flex items-center gap-2.5 py-1.5 text-left pressable" type="button">
                    <span className="w-9 h-9 shrink-0 rounded-full bg-white flex items-center justify-center text-[18px] border border-white/80 shadow-[0_8px_16px_rgba(90,100,160,0.06)]">{CATEGORY_EMOJI[place.category] ?? '📍'}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-label-lg font-bold text-on-surface truncate">{place.name}</span>
                      <span className="block text-label-sm text-on-surface-variant">
                        마지막 {daysAgo(v.daysSince)} · {v.days}번 갔어요
                      </span>
                    </span>
                    <span className="material-symbols-rounded text-[20px] text-gray-400">chevron_right</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
