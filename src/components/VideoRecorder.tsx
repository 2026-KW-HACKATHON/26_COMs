import { useEffect, useRef, useState } from 'react';
import { CLIP_SECONDS } from '../types/capsule';
import { captureFrame, pickRecorderMimeType } from '../lib/video';

interface VideoRecorderProps {
  onRecorded: (video: Blob, thumbnail: Blob | null) => void;
  onClose: () => void;
}

type Status = 'starting' | 'ready' | 'recording' | 'error';
type Facing = 'environment' | 'user';

function describeError(err: unknown) {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError') return '카메라 권한이 거부되었어요. 브라우저 설정에서 카메라를 허용하거나 앨범에서 영상을 선택해 주세요.';
  if (name === 'NotFoundError') return '사용할 수 있는 카메라를 찾지 못했어요. 앨범에서 영상을 선택해 주세요.';
  if (!window.isSecureContext) return '카메라는 https 또는 localhost 환경에서만 사용할 수 있어요.';
  return '카메라를 시작하지 못했어요. 앨범에서 영상을 선택해 주세요.';
}

async function openCamera(facing: Facing) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('getUserMedia unsupported');
  const video = { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } };
  try {
    return await navigator.mediaDevices.getUserMedia({ video, audio: true });
  } catch (err) {
    // 마이크가 없거나 막힌 기기에서는 소리 없이라도 촬영
    if (err instanceof DOMException && err.name !== 'NotAllowedError') {
      return navigator.mediaDevices.getUserMedia({ video });
    }
    throw err;
  }
}

const RING_RADIUS = 36;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

export default function VideoRecorder({ onRecorded, onClose }: VideoRecorderProps) {
  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const discardRef = useRef(false);
  const timersRef = useRef<{ raf: number; stop: number; thumb: number }>({ raf: 0, stop: 0, thumb: 0 });

  const [facing, setFacing] = useState<Facing>('environment');
  const [status, setStatus] = useState<Status>('starting');
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let cancelled = false;
    openCamera(facing)
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const el = previewRef.current;
        if (el) {
          el.srcObject = stream;
          el.play().catch(() => {});
        }
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(describeError(err));
        setStatus('error');
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facing]);

  // 촬영 도중 화면을 닫으면 녹화분은 버린다
  useEffect(() => {
    const timers = timersRef.current;
    discardRef.current = false; // StrictMode 재마운트 대비
    return () => {
      discardRef.current = true;
      cancelAnimationFrame(timers.raf);
      clearTimeout(timers.stop);
      clearTimeout(timers.thumb);
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    };
  }, []);

  const flipCamera = () => {
    setStatus('starting');
    setFacing((f) => (f === 'environment' ? 'user' : 'environment'));
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream || status !== 'ready') return;

    const mimeType = pickRecorderMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 2_500_000 } : undefined);
    } catch {
      setError('이 브라우저는 영상 촬영을 지원하지 않아요. 앨범에서 영상을 선택해 주세요.');
      setStatus('error');
      return;
    }

    const chunks: Blob[] = [];
    let thumbnail: Promise<Blob | null> = Promise.resolve(null);
    const timers = timersRef.current;

    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onstop = () => {
      cancelAnimationFrame(timers.raf);
      clearTimeout(timers.thumb);
      if (discardRef.current) return;
      const video = new Blob(chunks, { type: recorder.mimeType || mimeType || 'video/webm' });
      thumbnail.then((thumb) => onRecorded(video, thumb));
    };

    recorderRef.current = recorder;
    recorder.start();
    setStatus('recording');
    setElapsed(0);

    const startedAt = performance.now();
    const tick = () => {
      setElapsed(Math.min(CLIP_SECONDS, (performance.now() - startedAt) / 1000));
      timers.raf = requestAnimationFrame(tick);
    };
    timers.raf = requestAnimationFrame(tick);
    timers.thumb = window.setTimeout(() => {
      if (previewRef.current) thumbnail = captureFrame(previewRef.current).catch(() => null);
    }, 1000);
    // 정확히 5초에서 자동 종료
    timers.stop = window.setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop();
    }, CLIP_SECONDS * 1000);
  };

  const recording = status === 'recording';

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col text-white">
      <video
        ref={previewRef}
        muted
        playsInline
        autoPlay
        className={`absolute inset-0 w-full h-full object-cover ${facing === 'user' ? '-scale-x-100' : ''}`}
      />

      <div className="relative z-10 flex items-center justify-between px-4 pt-4">
        <button onClick={onClose} className="w-11 h-11 rounded-full bg-black/40 backdrop-blur flex items-center justify-center" type="button" aria-label="닫기">
          <span className="material-symbols-outlined text-[24px]">close</span>
        </button>
        <div className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur font-label-md text-label-md flex items-center gap-1.5">
          {recording && <span className="w-2 h-2 rounded-full bg-error animate-pulse" />}
          {recording ? `${elapsed.toFixed(1)} / ${CLIP_SECONDS}.0초` : `${CLIP_SECONDS}초 기억 촬영`}
        </div>
        <button
          onClick={flipCamera}
          disabled={recording || status === 'starting'}
          className="w-11 h-11 rounded-full bg-black/40 backdrop-blur flex items-center justify-center disabled:opacity-40"
          type="button"
          aria-label="카메라 전환"
        >
          <span className="material-symbols-outlined text-[24px]">cameraswitch</span>
        </button>
      </div>

      {status === 'error' && (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 text-center gap-4">
          <span className="material-symbols-outlined text-[48px] opacity-70">videocam_off</span>
          <p className="font-body-md text-body-md leading-relaxed">{error}</p>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-white text-on-surface font-label-lg" type="button">
            돌아가기
          </button>
        </div>
      )}

      {status !== 'error' && (
        <div className="relative z-10 mt-auto pb-10 flex flex-col items-center gap-3">
          <p className="font-label-md text-label-md bg-black/40 backdrop-blur px-3 py-1 rounded-full">
            {status === 'starting' ? '카메라 준비 중…' : recording ? '지금 이 순간을 담는 중' : '버튼을 누르면 5초 동안 촬영돼요'}
          </p>
          <button
            onClick={startRecording}
            disabled={status !== 'ready'}
            className="relative w-20 h-20 flex items-center justify-center disabled:opacity-60"
            type="button"
            aria-label="5초 촬영 시작"
          >
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r={RING_RADIUS} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="5" />
              <circle
                cx="40"
                cy="40"
                r={RING_RADIUS}
                fill="none"
                stroke="#ff7b54"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={RING_LENGTH}
                strokeDashoffset={RING_LENGTH * (1 - elapsed / CLIP_SECONDS)}
              />
            </svg>
            <span className={`bg-primary-container transition-all ${recording ? 'w-7 h-7 rounded-md' : 'w-14 h-14 rounded-full'}`} />
          </button>
        </div>
      )}
    </div>
  );
}
