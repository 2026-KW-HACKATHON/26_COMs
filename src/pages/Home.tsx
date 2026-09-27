import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import CapsuleThumb from '../components/CapsuleThumb';
import PlaceMap from '../components/PlaceMap';
import PlaceSearch from '../components/PlaceSearch';
import { useCapsules } from '../hooks/useCapsules';
import { CATEGORY_EMOJI, PLACES, getPlace, placeSubtitle } from '../data/places';

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const capsules = useCapsules();
  // 남기기·영상 상세에서 넘어오면 해당 장소를 선택한 채로 연다
  const [selectedId, setSelectedId] = useState<string | null>((location.state as { placeId?: string } | null)?.placeId ?? null);

  const videoCount = useMemo(() => {
    const counts = new Map<string, number>();
    capsules?.forEach((c) => counts.set(c.placeId, (counts.get(c.placeId) ?? 0) + 1));
    return counts;
  }, [capsules]);

  const selected = getPlace(selectedId);
  const selectedVideos = capsules?.filter((c) => c.placeId === selectedId) ?? [];

  return (
    <div className="relative w-full h-[calc(100dvh-4rem)]">
      <PlaceMap
        places={PLACES}
        selectedId={selectedId}
        onSelect={(p) => setSelectedId(p.id)}
        videoCount={videoCount}
        className="absolute inset-0"
      />

      <div className="absolute top-3 inset-x-3 z-10">
        <PlaceSearch onPick={(p) => setSelectedId(p.id)} />
      </div>

      {selected ? (
        <div className="absolute bottom-24 inset-x-3 z-10 bg-surface-container-lowest rounded-3xl p-4 shadow-xl flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <span className="w-11 h-11 shrink-0 rounded-full bg-primary-fixed flex items-center justify-center text-[22px]">
              {CATEGORY_EMOJI[selected.category] ?? '📍'}
            </span>
            <div className="flex-1 min-w-0">
              <h2 className="font-headline-sm text-headline-sm text-on-surface truncate">{selected.name}</h2>
              <p className="font-label-sm text-label-sm text-on-surface-variant truncate">
                {[placeSubtitle(selected), selected.address].filter(Boolean).join(' · ')}
              </p>
            </div>
            <button onClick={() => setSelectedId(null)} className="w-9 h-9 shrink-0 rounded-full bg-surface-container-low text-on-surface-variant flex items-center justify-center" type="button" aria-label="닫기">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {selectedVideos.length > 0 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {selectedVideos.map((c) => (
                <button key={c.id} onClick={() => navigate(`/video/${c.id}`)} className="relative w-16 h-20 shrink-0 rounded-lg overflow-hidden bg-surface-container" type="button">
                  <CapsuleThumb thumbnail={c.thumbnail} />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
                    <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => navigate(`/leave?place=${encodeURIComponent(selected.id)}`)}
            className="h-12 rounded-xl bg-gradient-to-r from-secondary-container via-primary-container to-primary text-on-primary font-label-lg text-label-lg font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">videocam</span>
            여기에 5초 영상 남기기
          </button>
        </div>
      ) : (
        <div className="absolute bottom-24 inset-x-0 z-10 flex justify-center pointer-events-none">
          <span className="px-3 py-1.5 rounded-full bg-inverse-surface/85 text-inverse-on-surface font-label-md text-label-md shadow-md">
            가게를 눌러 그곳의 5초를 남겨보세요
          </span>
        </div>
      )}
    </div>
  );
}
