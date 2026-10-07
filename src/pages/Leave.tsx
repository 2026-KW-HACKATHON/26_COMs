import { useRef, useState, type ChangeEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CapsuleVideo from '../components/CapsuleVideo';
import FriendTagPicker from '../components/FriendTagPicker';
import PlaceMap from '../components/PlaceMap';
import PlaceSearch from '../components/PlaceSearch';
import VideoRecorder from '../components/VideoRecorder';
import { CATEGORY_EMOJI, getPlace, placeSubtitle } from '../data/places';
import { useFriendships } from '../hooks/useFriendships';
import { MAX_VIDEO_BYTES, SOCIAL_ENABLED, STORAGE_MODE, addCapsule } from '../lib/capsuleStore';
import { formatSeconds } from '../lib/format';
import { probeDuration, thumbnailAt } from '../lib/video';
import { CLIP_SECONDS } from '../types/capsule';
import type { Profile } from '../types/social';

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
  const [tags, setTags] = useState<Profile[]>([]);
  const { list: friendships } = useFriendships();
  const friends = friendships?.filter((f) => f.status === 'friend') ?? null;

  const place = getPlace(placeId);

  /** seconds: 실제로 촬영한 길이 (중간에 멈추면 5초보다 짧다) */
  const handleRecorded = async (blob: Blob, thumbnail: Blob | null, seconds: number) => {
    setRecorderOpen(false);
    setVideoError('');
    const duration = await probeDuration(blob).catch(() => 0);
    setVideo({ blob, duration: duration || seconds, clipStart: 0, thumbnail, source: 'camera' });
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
        tagIds: tags.map((t) => t.id),
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
    <div className="flex flex-col w-full pb-6 pt-2">
      <section className="flex flex-col gap-3 pb-6">
        <StepTitle step={1} title="어디에서 남길까요?" />
        <div className="relative h-72 rounded-2xl overflow-hidden">
          <PlaceMap selectedId={placeId} onSelect={(p) => setPlaceId(p.id)} className="absolute inset-0" />
          <div className="absolute top-2 inset-x-2 z-10">
            <PlaceSearch onPick={(p) => setPlaceId(p.id)} />
          </div>
        </div>
        {place ? (
          <div className="bg-surface-container-low rounded-2xl px-4 py-3 flex items-center gap-3">
            <span className="w-10 h-10 shrink-0 rounded-full bg-surface flex items-center justify-center text-[20px]">{CATEGORY_EMOJI[place.category] ?? '📍'}</span>
            <div className="flex flex-col min-w-0">
              <span className="text-label-lg text-on-surface font-bold truncate">{place.name}</span>
              <span className="text-label-sm text-on-surface-variant truncate">{[placeSubtitle(place), place.address].filter(Boolean).join(' · ')}</span>
            </div>
            <span className="material-symbols-rounded text-primary text-[24px] ml-auto icon-fill">check_circle</span>
          </div>
        ) : (
          <p className="text-label-md text-on-surface-variant">지도에서 건물을 누르거나 가게 이름을 검색해 주세요.</p>
        )}
      </section>

      <Divider />

      <section className="flex flex-col gap-3 py-6">
        <div className="flex items-center justify-between">
          <StepTitle step={2} title="5초 영상을 담아 주세요" />
          {video && (
            <span className="text-label-md text-primary font-bold px-2.5 py-1 bg-primary-fixed rounded-full">
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
              className="w-full aspect-[3/4] rounded-2xl"
            />
            {canTrim && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-label-sm text-on-surface-variant">
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
                  className="w-full accent-primary"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setRecorderOpen(true)} className="h-12 rounded-xl bg-surface-container text-gray-700 text-label-lg flex items-center justify-center gap-1 pressable" type="button">
                <span className="material-symbols-rounded text-[20px]">replay</span> 다시 촬영
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="h-12 rounded-xl bg-surface-container text-gray-700 text-label-lg flex items-center justify-center gap-1 pressable" type="button">
                <span className="material-symbols-rounded text-[20px]">video_library</span> 다른 영상
              </button>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => setRecorderOpen(true)}
              className="h-36 rounded-2xl bg-primary-fixed flex flex-col items-center justify-center gap-2 pressable"
              type="button"
            >
              <span className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center">
                <span className="material-symbols-rounded text-[26px] icon-fill">videocam</span>
              </span>
              <span className="text-label-lg font-bold text-on-primary-fixed">지금 5초 촬영</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={processing}
              className="h-36 rounded-2xl bg-surface-container flex flex-col items-center justify-center gap-2 pressable disabled:opacity-60"
              type="button"
            >
              <span className="w-12 h-12 rounded-full bg-surface text-gray-600 flex items-center justify-center">
                <span className="material-symbols-rounded text-[26px]">{processing ? 'hourglass_top' : 'photo_library'}</span>
              </span>
              <span className="text-label-lg font-bold text-gray-700">{processing ? '영상 확인 중…' : '앨범에서 선택'}</span>
            </button>
          </div>
        )}

        {videoError && <p className="text-label-sm text-error">{videoError}</p>}
        <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFile} />
      </section>

      {SOCIAL_ENABLED && (
        <>
          <Divider />
          <section className="flex flex-col gap-3 py-6">
            <div className="flex items-center justify-between">
              <StepTitle step={3} title="함께한 친구가 있나요?" />
              <span className="text-label-sm text-gray-400">선택</span>
            </div>
            <FriendTagPicker friends={friends} selected={tags} onChange={setTags} />
          </section>
        </>
      )}

      <div className="flex flex-col gap-2 pt-2">
        <button
          onClick={handleLeave}
          disabled={!!missing || saving}
          className="w-full h-14 rounded-2xl bg-primary text-on-primary text-[17px] font-bold flex items-center justify-center pressable disabled:bg-gray-200 disabled:text-gray-400"
          type="button"
        >
          {saving ? '남기는 중…' : '남기기'}
        </button>
        {missing && <p className="text-center text-label-sm text-on-surface-variant">{missing}</p>}
      </div>

      {recorderOpen && <VideoRecorder onRecorded={handleRecorded} onClose={() => setRecorderOpen(false)} />}
    </div>
  );
}

function StepTitle({ step, title }: { step: number; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-6 h-6 rounded-full bg-inverse-surface text-inverse-on-surface text-[12px] font-bold flex items-center justify-center">{step}</span>
      <h2 className="text-headline-sm text-on-surface">{title}</h2>
    </div>
  );
}

/** 토스식 굵은 구분선 (화면 끝까지) */
function Divider() {
  return <div className="h-2 -mx-5 bg-surface-container" />;
}
