import { useRef, useState, type ChangeEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CapsuleVideo from '../components/CapsuleVideo';
import PlaceMap from '../components/PlaceMap';
import PlaceSearch from '../components/PlaceSearch';
import VideoRecorder from '../components/VideoRecorder';
import { CATEGORY_EMOJI, PLACES, getPlace, placeSubtitle } from '../data/places';
import { MAX_VIDEO_BYTES, STORAGE_MODE, addCapsule } from '../lib/capsuleStore';
import { formatSeconds } from '../lib/format';
import { probeDuration, thumbnailAt } from '../lib/video';
import { CLIP_SECONDS } from '../types/capsule';

interface DraftVideo {
  blob: Blob;
  duration: number;
  clipStart: number;
  thumbnail: Blob | null;
  source: 'camera' | 'upload';
}

export default function Leave() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [placeId, setPlaceId] = useState<string | null>(() => getPlace(searchParams.get('place'))?.id ?? null);
  const [video, setVideo] = useState<DraftVideo | null>(null);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [videoError, setVideoError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);

  const place = getPlace(placeId);

  const handleRecorded = async (blob: Blob, thumbnail: Blob | null) => {
    setRecorderOpen(false);
    setVideoError('');
    const duration = await probeDuration(blob).catch(() => 0);
    setVideo({ blob, duration: duration || CLIP_SECONDS, clipStart: 0, thumbnail, source: 'camera' });
  };

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setVideoError('');
    if (file.type && !file.type.startsWith('video/')) {
      setVideoError('동영상 파일만 올릴 수 있어요.');
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setVideoError(`영상 용량이 너무 커요 (최대 ${MAX_VIDEO_BYTES / 1024 / 1024}MB). 더 짧은 영상을 선택하거나 앱에서 5초 촬영해 주세요.`);
      return;
    }
    setProcessing(true);
    try {
      const duration = await probeDuration(file);
      if (!duration) throw new Error('empty');
      setVideo({ blob: file, duration, clipStart: 0, thumbnail: null, source: 'upload' });
    } catch {
      setVideoError('이 영상은 브라우저에서 재생할 수 없는 형식이에요. 다른 영상을 선택해 주세요.');
    } finally {
      setProcessing(false);
    }
  };

  const missing = !place ? '지도에서 방문한 장소를 골라 주세요' : !video ? '5초 영상을 추가해 주세요' : '';

  const handleLeave = async () => {
    if (!place || !video || saving) return;
    setSaving(true);
    try {
      const clipDuration = Math.min(CLIP_SECONDS, video.duration - video.clipStart);
      // 앨범 영상은 사용자가 고른 구간의 첫 부분을 썸네일로 쓴다
      let thumbnail = video.source === 'camera' ? video.thumbnail : null;
      if (!thumbnail) {
        thumbnail = await thumbnailAt(video.blob, video.clipStart + Math.min(1, clipDuration / 2)).catch(() => null);
      }
      await addCapsule({
        placeId: place.id,
        placeName: place.name,
        lat: place.lat,
        lng: place.lng,
        video: video.blob,
        clipStart: video.clipStart,
        clipDuration,
        thumbnail,
      });
      navigator.vibrate?.(30);
      navigate('/', { replace: true, state: { placeId: place.id } });
    } catch (err) {
      console.error(err);
      alert(STORAGE_MODE === 'cloud' ? '영상을 올리지 못했어요. 네트워크 상태를 확인하고 다시 시도해 주세요.' : '영상을 저장하지 못했어요. 기기 저장 공간을 확인해 주세요.');
      setSaving(false);
    }
  };

  const canTrim = video && video.duration > CLIP_SECONDS + 0.1;

  return (
    <div className="flex flex-col w-full pb-6 space-y-5 pt-3">
      <section className="bg-surface-container-lowest rounded-xl p-space-md shadow-[0_4px_20px_rgba(45,41,38,0.05)] flex flex-col gap-3">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-container text-on-primary text-[11px] font-bold">1</span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">방문 장소</h2>
        </div>
        <div className="relative h-64 rounded-xl overflow-hidden">
          <PlaceMap places={PLACES} selectedId={placeId} onSelect={(p) => setPlaceId(p.id)} className="absolute inset-0" />
          <div className="absolute top-2 inset-x-2 z-10">
            <PlaceSearch onPick={(p) => setPlaceId(p.id)} />
          </div>
        </div>
        {place ? (
          <div className="bg-surface-container-low rounded-xl px-3 py-2.5 flex items-center gap-3">
            <span className="w-9 h-9 shrink-0 rounded-full bg-primary-fixed flex items-center justify-center text-[18px]">{CATEGORY_EMOJI[place.category] ?? '📍'}</span>
            <div className="flex flex-col min-w-0">
              <span className="font-label-lg text-label-lg text-on-surface font-bold truncate">{place.name}</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant truncate">{[placeSubtitle(place), place.address].filter(Boolean).join(' · ')}</span>
            </div>
            <span className="material-symbols-outlined text-primary text-[22px] ml-auto" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          </div>
        ) : (
          <p className="font-label-md text-label-md text-on-surface-variant">지도에서 가게 핀을 누르거나 검색해 주세요.</p>
        )}
      </section>

      <section className="bg-surface-container-lowest rounded-xl p-space-md shadow-[0_4px_20px_rgba(45,41,38,0.05)] flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-container text-on-primary text-[11px] font-bold">2</span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">5초 영상 추가</h2>
          </div>
          {video && (
            <span className="font-label-md text-label-md text-primary font-bold px-2 py-0.5 bg-primary-fixed/40 rounded-full">
              {Math.min(CLIP_SECONDS, video.duration).toFixed(1)}초
            </span>
          )}
        </div>

        {video ? (
          <>
            <CapsuleVideo
              src={video.blob}
              start={video.clipStart}
              duration={Math.min(CLIP_SECONDS, video.duration)}
              className="w-full aspect-[3/4] rounded-xl"
            />
            {canTrim && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant">
                  <span>담을 5초 구간 고르기</span>
                  <span className="text-primary font-bold">
                    {formatSeconds(video.clipStart)} ~ {formatSeconds(video.clipStart + CLIP_SECONDS)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={video.duration - CLIP_SECONDS}
                  step={0.1}
                  value={video.clipStart}
                  onChange={(e) => setVideo({ ...video, clipStart: Number(e.target.value) })}
                  className="w-full accent-[#ff7b54]"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setRecorderOpen(true)} className="h-11 rounded-lg bg-surface-container text-on-surface font-label-md text-label-md flex items-center justify-center gap-1 hover:bg-surface-container-high" type="button">
                <span className="material-symbols-outlined text-[18px]">replay</span> 다시 촬영
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="h-11 rounded-lg bg-surface-container text-on-surface font-label-md text-label-md flex items-center justify-center gap-1 hover:bg-surface-container-high" type="button">
                <span className="material-symbols-outlined text-[18px]">video_library</span> 다른 영상 선택
              </button>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => setRecorderOpen(true)}
              className="h-36 rounded-xl bg-gradient-to-br from-primary-fixed to-secondary-container flex flex-col items-center justify-center text-on-primary-fixed gap-1.5 active:scale-[0.98] transition-transform"
              type="button"
            >
              <span className="w-11 h-11 rounded-full bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm">
                <span className="material-symbols-outlined text-[24px]">videocam</span>
              </span>
              <span className="font-label-lg text-label-lg font-bold">지금 5초 촬영</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={processing}
              className="h-36 rounded-xl bg-surface-container flex flex-col items-center justify-center text-on-surface-variant gap-1.5 hover:bg-surface-container-high transition-colors disabled:opacity-60"
              type="button"
            >
              <span className="w-11 h-11 rounded-full bg-surface-container-highest flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[24px]">{processing ? 'hourglass_top' : 'video_library'}</span>
              </span>
              <span className="font-label-lg text-label-lg font-bold">{processing ? '영상 확인 중…' : '앨범에서 선택'}</span>
            </button>
          </div>
        )}

        {videoError && <p className="font-label-sm text-label-sm text-error">{videoError}</p>}
        <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFile} />
      </section>

      <div className="flex flex-col gap-2">
        <button
          onClick={handleLeave}
          disabled={!!missing || saving}
          className="w-full h-14 rounded-xl bg-gradient-to-r from-secondary-container via-primary-container to-primary text-on-primary font-headline-sm text-headline-sm font-bold shadow-[0_10px_24px_-4px_rgba(255,123,84,0.38)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none"
          type="button"
        >
          <span className="material-symbols-outlined text-[22px]">bookmark_add</span>
          <span>{saving ? '남기는 중…' : '남기기'}</span>
        </button>
        {missing && <p className="text-center font-label-sm text-label-sm text-on-surface-variant">{missing}</p>}
      </div>

      {recorderOpen && <VideoRecorder onRecorded={handleRecorded} onClose={() => setRecorderOpen(false)} />}
    </div>
  );
}
