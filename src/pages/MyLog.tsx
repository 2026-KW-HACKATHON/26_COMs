import { useNavigate } from 'react-router-dom';
import CapsuleThumb from '../components/CapsuleThumb';
import { useCapsules } from '../hooks/useCapsules';
import { STORAGE_MODE } from '../lib/capsuleStore';
import { formatDate } from '../lib/format';

export default function MyLog() {
  const navigate = useNavigate();
  const capsules = useCapsules();

  if (!capsules) return null;

  return (
    <div className="flex flex-col w-full pb-6 pt-3">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-headline-md text-headline-md text-on-surface">내 영상</h2>
        <span className="font-label-md text-label-md text-on-surface-variant">{capsules.length}개</span>
      </div>
      {STORAGE_MODE === 'device' && (
        <p className="-mt-1 mb-3 font-label-sm text-label-sm text-on-surface-variant">영상은 이 기기 브라우저에만 저장돼요.</p>
      )}

      {capsules.length === 0 ? (
        <div className="flex flex-col items-center text-center py-14 px-6 rounded-2xl bg-surface-container-low text-on-surface-variant">
          <span className="material-symbols-outlined text-[40px] opacity-60">videocam</span>
          <p className="mt-2 font-body-md text-body-md">아직 남긴 영상이 없어요.</p>
          <button onClick={() => navigate('/leave')} className="mt-4 px-5 py-2.5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg shadow-sm" type="button">
            첫 영상 남기기
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {capsules.map((c) => (
            <button key={c.id} onClick={() => navigate(`/video/${c.id}`)} className="flex flex-col text-left rounded-2xl overflow-hidden bg-surface-container-lowest shadow-sm active:scale-[0.98] transition-transform" type="button">
              <div className="relative w-full aspect-[3/4] bg-surface-container-high">
                <CapsuleThumb thumbnail={c.thumbnail} />
                <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-full bg-black/50 text-white font-label-sm text-[11px] flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[12px]">play_arrow</span>
                  {Math.round(c.clipDuration)}초
                </span>
              </div>
              <div className="px-2.5 py-2">
                <p className="font-label-lg text-label-lg text-on-surface font-bold truncate">{c.placeName}</p>
                <p className="font-label-sm text-label-sm text-on-surface-variant">{formatDate(c.createdAt)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
