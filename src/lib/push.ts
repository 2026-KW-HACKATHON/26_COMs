import { supabase } from './supabase';

// 폰 알림(웹 푸시). 친구가 조르면 앱을 닫아 둬도 폰에 알림이 뜬다.
// 받는 쪽: 이 기기의 구독을 push_subscriptions에 저장하고, 서비스 워커(public/push-sw.js)가 알림을 띄운다.
// 보내는 쪽: 조르기를 만든 뒤 api/push.ts(Vercel 서버 함수)에 알림을 요청한다.
// VITE_VAPID_PUBLIC_KEY가 없으면 조르기는 앱 안 알림(벨·배너)으로만 보인다 (README "폰 알림" 참고).

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';

/** on: 켜짐, off: 켤 수 있음, denied: 브라우저에서 차단됨, install: 아이폰은 홈 화면 앱에서만, unsupported: 이 환경에서 못 씀 */
export type PushState = 'on' | 'off' | 'denied' | 'install' | 'unsupported';

const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

function serverKey() {
  const base64 = VAPID_PUBLIC_KEY.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (VAPID_PUBLIC_KEY.length % 4)) % 4);
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/** 키를 바꾼 뒤에 만든 구독인지 (예전 키로 만든 구독에는 보낼 수 없다) */
function sameKey(subscription: PushSubscription, key: Uint8Array) {
  const current = subscription.options.applicationServerKey;
  if (!current || current.byteLength !== key.length) return false;
  const bytes = new Uint8Array(current);
  return bytes.every((b, i) => b === key[i]);
}

/** 서비스 워커는 빌드 결과(배포 주소·npm run preview)에서만 등록된다. 개발 서버에서는 null */
async function pushManager(): Promise<PushManager | null> {
  if (!VAPID_PUBLIC_KEY || !supabase || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return null;
  }
  const registration = await navigator.serviceWorker.getRegistration();
  return registration?.pushManager ?? null;
}

async function save(subscription: PushSubscription) {
  const { endpoint, keys } = subscription.toJSON();
  if (!supabase || !endpoint || !keys?.p256dh || !keys.auth) throw new Error('invalid push subscription');
  const { error } = await supabase.rpc('save_push_subscription', {
    sub_endpoint: endpoint,
    sub_p256dh: keys.p256dh,
    sub_auth: keys.auth,
  });
  if (error) throw error;
}

export async function getPushState(): Promise<PushState> {
  if (!VAPID_PUBLIC_KEY || !supabase) return 'unsupported';
  // 아이폰 사파리는 홈 화면에 추가한 앱에서만 알림 기능이 생긴다 (iOS 16.4 이상)
  if (!('PushManager' in window) || !('Notification' in window)) return isIos() && !isStandalone() ? 'install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const manager = await pushManager();
  if (!manager) return 'unsupported';
  const subscription = await manager.getSubscription();
  return subscription && Notification.permission === 'granted' ? 'on' : 'off';
}

/** 알림 켜기. 버튼을 누른 직후에 불러야 브라우저가 권한을 물어본다 */
export async function enablePush(): Promise<PushState> {
  if (!VAPID_PUBLIC_KEY || !supabase || !('Notification' in window)) return getPushState();
  // 사파리는 누른 직후에만 권한을 물을 수 있어서 다른 일보다 먼저
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';
  const manager = await pushManager();
  if (!manager) return 'unsupported';
  const key = serverKey();
  let subscription = await manager.getSubscription();
  if (subscription && !sameKey(subscription, key)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await manager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await save(subscription);
  return 'on';
}

/** 알림 끄기·로그아웃: 이 기기 구독을 지운다 (같은 기기에 다음에 로그인하는 사람에게 가지 않게) */
export async function disablePush(): Promise<void> {
  const manager = await pushManager();
  const subscription = await manager?.getSubscription();
  if (!subscription || !supabase) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
  await subscription.unsubscribe();
}

/** 로그인할 때 이 기기 구독을 다시 저장한다 (브라우저가 구독을 바꿨거나 서버에서 지워졌을 수 있다) */
export async function syncPush(): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const manager = await pushManager();
  const subscription = await manager?.getSubscription();
  if (subscription && sameKey(subscription, serverKey())) await save(subscription);
}

/** 방금 만든 조르기를 받는 친구의 폰으로 보낸다. 실패해도 조르기는 앱 안 알림으로 간다 */
export async function sendNudgePush(nudgeId: string): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !supabase) return;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return;
  try {
    const res = await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ nudgeId }),
      keepalive: true,
    });
    if (!res.ok) console.warn('push failed', res.status);
  } catch (err) {
    console.warn(err);
  }
}
