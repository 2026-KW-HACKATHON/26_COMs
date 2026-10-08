import { useState } from 'react';
import { CATEGORY_EMOJI, PLACES, placeSubtitle, type Place } from '../data/places';

interface PlaceSearchProps {
  onPick: (place: Place) => void;
}

export default function PlaceSearch({ onPick }: PlaceSearchProps) {
  const [query, setQuery] = useState('');
  const q = query.trim();
  const results = q ? PLACES.filter((p) => p.name.includes(q) || placeSubtitle(p).includes(q)).slice(0, 6) : [];

  return (
    <div className="bg-surface rounded-2xl shadow-float overflow-hidden">
      <div className="flex items-center gap-2 px-4 h-12">
        <span className="material-symbols-rounded text-[22px] text-gray-400">search</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="월계1동 식당·카페 검색"
          className="flex-1 min-w-0 bg-transparent outline-none text-[16px] text-on-surface placeholder:text-gray-400"
        />
        {query && (
          <button onClick={() => setQuery('')} className="w-6 h-6 rounded-full bg-gray-300 text-white flex items-center justify-center" type="button" aria-label="지우기">
            <span className="material-symbols-rounded text-[16px]">close</span>
          </button>
        )}
      </div>
      {q && (
        <ul className="border-t border-gray-100 max-h-72 overflow-y-auto py-1">
          {results.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => {
                  onPick(p);
                  setQuery('');
                }}
                className="w-full px-4 py-2.5 flex items-center gap-3 text-left active:bg-surface-container-low"
                type="button"
              >
                <span className="w-9 h-9 shrink-0 rounded-full bg-surface-container flex items-center justify-center text-[18px]">{CATEGORY_EMOJI[p.category] ?? '📍'}</span>
                <span className="flex flex-col min-w-0">
                  <span className="text-label-lg text-on-surface truncate">{p.name}</span>
                  <span className="text-label-sm text-on-surface-variant truncate">{placeSubtitle(p)}</span>
                </span>
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="px-4 py-3 text-label-md text-on-surface-variant">검색 결과가 없어요</li>}
        </ul>
      )}
    </div>
  );
}
