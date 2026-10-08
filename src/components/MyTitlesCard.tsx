import { useMemo } from 'react';
import { SOCIAL_ENABLED } from '../lib/capsuleStore';
import { TIERS, myTitles, nextGoal } from '../lib/titles';
import type { MyPlaceVisit } from '../lib/visits';
import TitleBadge from './TitleBadge';

/** MY 탭: 내가 딴 칭호(대표 칭호부터)와 다음 등급에 가장 가까운 가게 */
export default function MyTitlesCard({ visits }: { visits: Map<string, MyPlaceVisit> }) {
  const titles = useMemo(() => myTitles(visits), [visits]);
  const goal = useMemo(() => nextGoal(visits), [visits]);

  return (
    <section className="p-5 flat-card rounded-3xl">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-label-lg font-bold text-on-surface">내 칭호</h3>
        {SOCIAL_ENABLED && titles.length > 0 && <span className="text-label-sm text-gray-400">대표 칭호는 친구에게 보여요</span>}
      </div>

      {titles.length > 0 ? (
        <ul className="mt-2.5 flex flex-col gap-2">
          {titles.map((t, i) => (
            <li key={t.placeId} className="flex items-center gap-2 min-w-0">
              <TitleBadge title={t} size="md" />
              {i === 0 && titles.length > 1 && <span className="shrink-0 text-label-sm font-semibold text-primary">대표</span>}
              <span className="ml-auto shrink-0 text-label-sm text-on-surface-variant">{t.visits}번</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-label-md text-on-surface-variant">한 가게에 {TIERS[0].min}번 가면 '가게 이름 + 등급' 칭호가 생겨요.</p>
      )}

      {goal && (
        <p className="mt-3 flex items-center gap-1 text-label-md text-on-surface">
          <span className="material-symbols-rounded shrink-0 text-[18px] text-primary">flag</span>
          <b className="min-w-0 truncate">{goal.placeName}</b>
          <span className="shrink-0">
            {goal.left}번 더 가면 {goal.tier.name}
          </span>
        </p>
      )}
      <p className="mt-2 text-label-sm text-gray-400">
        {TIERS.map((t) => `${t.name} ${t.min}번`).join(' · ')} (같은 날은 한 번)
      </p>
    </section>
  );
}
