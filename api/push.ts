// 조르기 폰 알림(웹 푸시) 보내기. Vercel 서버 함수: POST /api/push { nudgeId }, Authorization: Bearer <로그인 토큰>
// 앱(src/lib/push.ts)이 nudge_friend()로 조르기를 만든 직후 부른다. 받는 친구의 기기 구독은 secret key로만 읽을 수 있어서
// 서버에서 보낸다. 받은 기기에서는 public/push-sw.js가 알림을 띄운다.
// Vercel 환경변수: VITE_SUPABASE_URL, SUPABASE_SECRET_KEY, VITE_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (README "폰 알림" 참고)
import { createClient } from '@supabase/supabase-js';
import webpush, { type WebPushError } from 'web-push';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** 방금 만든 조르기만 보낸다 (지난 조르기로 다시 울리지 못하게) */
const FRESH_MS = 60 * 1000;
/** 한 사람에게 보낼 최대 기기 수 */
const MAX_DEVICES = 10;
/**
 * 브라우저 회사의 알림 서버로만 보낸다. 구독 주소는 사용자가 저장하는 값이라,
 * 막지 않으면 이 서버가 아무 주소로나 요청을 보내게 만들 수 있다.
 */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/, // Chrome·Android·삼성 인터넷
  /^updates\.push\.services\.mozilla\.com$/, // Firefox
  /^[a-z0-9.-]+\.push\.apple\.com$/, // Safari·iPhone
  /^[a-z0-9.-]+\.notify\.windows\.com$/, // Edge
];
/** VAPID 연락처 (알림 서버가 문제가 있을 때 연락하는 주소). https 또는 mailto: 만 된다 */
const DEFAULT_SUBJECT = 'https://26-coms.vercel.app';

interface NudgeRow {
  receiver_id: string;
  capsule_id: string | null;
  place_name: string;
  sender: { display_name: string } | null;
}

interface SubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

const json = (body: unknown, status = 200) => Response.json(body, { status });

function allowedEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && PUSH_HOSTS.some((host) => host.test(url.hostname));
  } catch {
    return false;
  }
}

export async function POST(request: Request): Promise<Response> {
  const {
    VITE_SUPABASE_URL: url,
    SUPABASE_SECRET_KEY: secretKey,
    VITE_VAPID_PUBLIC_KEY: publicKey,
    VAPID_PRIVATE_KEY: privateKey,
    VAPID_SUBJECT: subject = DEFAULT_SUBJECT,
  } = process.env;
  if (!url || !secretKey || !publicKey || !privateKey) return json({ error: 'push is not configured' }, 503);

  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  const body = (await request.json().catch(() => null)) as { nudgeId?: unknown } | null;
  const nudgeId = body?.nudgeId;
  if (!token || typeof nudgeId !== 'string' || !UUID.test(nudgeId)) return json({ error: 'bad request' }, 400);

  const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json({ error: 'unauthorized' }, 401);

  // 보낸 사람 본인이, 방금 만든 조르기를, 한 번만 (pushed_at이 비어 있을 때만 채우므로 다시 불러도 또 울리지 않는다)
  const { data, error } = await admin
    .from('nudges')
    .update({ pushed_at: new Date().toISOString() })
    .eq('id', nudgeId)
    .eq('sender_id', auth.user.id)
    .is('pushed_at', null)
    .gte('created_at', new Date(Date.now() - FRESH_MS).toISOString())
    .select('receiver_id, capsule_id, place_name, sender:profiles!nudges_sender_id_fkey(display_name)')
    .maybeSingle();
  if (error) {
    console.error(error);
    return json({ error: 'database error' }, 500);
  }
  const nudge = data as unknown as NudgeRow | null;
  if (!nudge) return json({ error: 'not found' }, 404);

  const [subs, unread] = await Promise.all([
    admin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', nudge.receiver_id)
      .order('created_at', { ascending: false })
      .limit(MAX_DEVICES),
    admin.from('nudges').select('id', { count: 'exact', head: true }).eq('receiver_id', nudge.receiver_id).is('read_at', null),
  ]);
  if (subs.error) {
    console.error(subs.error);
    return json({ error: 'database error' }, 500);
  }
  const devices = (subs.data as SubscriptionRow[]).filter((s) => allowedEndpoint(s.endpoint));
  if (!devices.length) return json({ sent: 0 });

  const name = nudge.sender?.display_name ?? '친구';
  const payload = JSON.stringify({
    title: `${name}님이 또 가자고 졸라요`,
    body: `${nudge.place_name}에 또 가고 싶대요. 같이 남긴 영상 보러 가기`,
    url: nudge.capsule_id ? `/video/${nudge.capsule_id}` : '/notifications',
    tag: `nudge-${nudgeId}`,
    badge: unread.count ?? 1,
  });

  webpush.setVapidDetails(subject, publicKey, privateKey);
  const results = await Promise.allSettled(
    devices.map((s) =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
        TTL: 24 * 60 * 60,
        urgency: 'high',
      }),
    ),
  );

  // 앱을 지웠거나 알림을 끈 기기(404·410)는 구독을 지운다
  const gone = devices
    .filter((_, i) => {
      const r = results[i];
      return r.status === 'rejected' && [404, 410].includes((r.reason as WebPushError).statusCode);
    })
    .map((s) => s.endpoint);
  if (gone.length) await admin.from('push_subscriptions').delete().in('endpoint', gone);
  for (const r of results) if (r.status === 'rejected') console.warn((r.reason as WebPushError).statusCode, (r.reason as Error).message);

  return json({ sent: results.filter((r) => r.status === 'fulfilled').length });
}
