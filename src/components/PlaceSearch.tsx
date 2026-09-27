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
    <div className="bg-surface-container-lowest/95 backdrop-blur-xl rounded-2xl shadow-md overflow-hidden">
      <div className="flex items-center gap-2 px-3 h-11">
        <span className="material-symbols-outlined text-[20px] text-on-surface-variant">search</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="월계1동 식당·카페 검색"
          className="flex-1 min-w-0 bg-transparent outline-none font-body-md text-body-md text-on-surface placeholder:text-outline/70"
        />
        {query && (
          <button onClick={() => setQuery('')} className="w-7 h-7 flex items-center justify-center text-on-surface-variant" type="button" aria-label="지우기">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        )}
      </div>
      {q && (
        <ul className="border-t border-outline-variant/40 max-h-64 overflow-y-auto">
          {results.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => {
                  onPick(p);
                  setQuery('');
                }}
                className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left hover:bg-surface-container-low"
                type="button"
              >
                <span className="text-[18px]">{CATEGORY_EMOJI[p.category] ?? '📍'}</span>
                <span className="flex flex-col min-w-0">
                  <span className="font-label-lg text-label-lg text-on-surface truncate">{p.name}</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant truncate">{placeSubtitle(p)}</span>
                </span>
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="px-3 py-3 font-label-md text-label-md text-on-surface-variant">검색 결과가 없어요</li>}
        </ul>
      )}
    </div>
  );
}
