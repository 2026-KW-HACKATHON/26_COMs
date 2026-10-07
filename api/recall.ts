// 회상 알림(웹 푸시): "한 달 전 오늘, ○○분식" — 일주일·한 달·100일·1년 전 오늘 남긴 영상을 그 영상에 나온 사람
// (작성자·태그된 친구)에게 알려 다시 가 보게 한다. 한 사람에게 하루 한 번, 가장 오래된 추억 하나만.
// Vercel 크론(vercel.json)이 매일 아침 10시(한국 시간)에 GET /api/recall을 부른다.
// Vercel 환경변수: CRON_SECRET(크론이 Authorization: Bearer로 보냄), VITE_SUPABASE_URL, SUPABASE_SECRET_KEY,
//                 VITE_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (README "회상 알림" 참고)
// 시연: curl -H "Authorization: Bearer <CRON_SECRET>" "https://<배포 주소>/api/recall?days=1" (어제 남긴 영상으로 바로 보내기)
import { createClient } from '@supabase/supabase-js';
import webpush, { type WebPushError } from 'web-push';

/** 앱의 src/lib/recall.ts와 같은 목록 (오래된 추억이 먼저) */
const ANNIVERSARIES = [
  { days: 365, label: '1년 전' },
  { days: 100, label: '100일 전' },
  { days: 30, label: '한 달 전' },
  { days: 7, label: '일주일 전' },
];
const DAY_MS = 86_400_000;
const KST_OFFSET_MS = 9 * 3_600_000;
/** 한 사람에게 보낼 최대 기기 수 (api/push.ts와 같음) */
const MAX_DEVICES = 10;
/** 브라우저 회사의 알림 서버로만 보낸다 (api/push.ts와 같은 규칙: 구독 주소는 사용자가 저장하는 값) */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^[a-z0-9.-]+\.push\.apple\.com$/,
  /^[a-z0-9.-]+\.notify\.windows\.com$/,
];
const DEFAULT_SUBJECT = 'https://26-coms.vercel.app';

interface CapsuleRow {
  id: string;
  user_id: string;
  place_name: string;
  author: { display_name: string } | null;
  capsule_tags: { user_id: string; profile: { display_name: string } | null }[];
}

interface SubscriptionRow {
  endpoint: string;
  user_id: string;
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

/** days일 전 한국 날짜 하루의 [시작, 끝) (ISO 문자열) */
function kstDayRange(days: number, now = Date.now()) {
  const start = (Math.floor((now + KST_OFFSET_MS) / DAY_MS) - days) * DAY_MS - KST_OFFSET_MS;
  return [new Date(start).toISOString(), new Date(start + DAY_MS).toISOString()];
}

export async function GET(request: Request): Promise<Response> {
  const {
    CRON_SECRET: cronSecret,
    VITE_SUPABASE_URL: url,
    SUPABASE_SECRET_KEY: secretKey,
    VITE_VAPID_PUBLIC_KEY: publicKey,
    VAPID_PRIVATE_KEY: privateKey,
    VAPID_SUBJECT: subject = DEFAULT_SUBJECT,
  } = process.env;
  // 크론 비밀값이 없으면 아무나 부를 수 있게 되므로 아예 동작하지 않는다
  if (!cronSecret || !url || !secretKey || !publicKey || !privateKey) return json({ error: 'recall is not configured' }, 503);
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) return json({ error: 'unauthorized' }, 401);

  // ?days=N: 시연용으로 N일 전 영상을 바로 보낸다 (크론은 쓰지 않음)
  const override = Number(new URL(request.url).searchParams.get('days'));
  const anniversaries =
    Number.isInteger(override) && override >= 1 && override <= 3650 ? [{ days: override, label: `${override}일 전` }] : ANNIVERSARIES;

  const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // 사람마다 가장 오래된 추억 하나 (ANNIVERSARIES가 오래된 순이라 먼저 고른 것을 남긴다)
  const picks = new Map<string, { capsule: CapsuleRow; label: string }>();
  for (const a of anniversaries) {
    const [from, to] = kstDayRange(a.days);
    const { data, error } = await admin
      .from('capsules')
      .select('id, user_id, place_name, author:profiles!capsules_user_id_fkey(display_name), capsule_tags(user_id, profile:profiles(display_name))')
      .gte('created_at', from)
      .lt('created_at', to)
      .order('created_at', { ascending: true })
      .limit(500);
    if (error) {
      console.error(error);
      return json({ error: 'database error' }, 500);
    }
    for (const c of data as unknown as CapsuleRow[]) {
      for (const person of [c.user_id, ...c.capsule_tags.map((t) => t.user_id)]) {
        if (!picks.has(person)) picks.set(person, { capsule: c, label: a.label });
      }
    }
  }
  if (!picks.size) return json({ people: 0, sent: 0 });

  const { data: subs, error: subsError } = await admin
    .from('push_subscriptions')
    .select('endpoint, user_id, p256dh, auth')
    .in('user_id', [...picks.keys()])
    .order('created_at', { ascending: false });
  if (subsError) {
    console.error(subsError);
    return json({ error: 'database error' }, 500);
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  const perUser = new Map<string, number>();
  const devices = (subs as SubscriptionRow[]).filter((s) => {
    const n = perUser.get(s.user_id) ?? 0;
    perUser.set(s.user_id, n + 1);
    return n < MAX_DEVICES && allowedEndpoint(s.endpoint);
  });

  const results = await Promise.allSettled(
    devices.map((s) => {
      const { capsule: c, label } = picks.get(s.user_id)!;
      // 같이 나온 사람 (받는 사람 제외): 작성자와 태그된 친구
      const names = [
        ...(c.user_id !== s.user_id && c.author ? [c.author.display_name] : []),
        ...c.capsule_tags.filter((t) => t.user_id !== s.user_id && t.profile).map((t) => t.profile!.display_name),
      ];
      const withText = names.length ? `${names[0]}님${names.length > 1 ? ` 외 ${names.length - 1}명` : ''}과 함께 남긴` : '그날 남긴';
      const payload = JSON.stringify({
        title: `${label} 오늘, ${c.place_name}`,
        body: `${withText} 5초가 열렸어요. 다시 가 볼까요?`,
        url: `/video/${c.id}`,
        tag: `recall-${c.id}`,
      });
      return webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
        TTL: 12 * 60 * 60,
        urgency: 'normal',
      });
    }),
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

  return json({ people: picks.size, sent: results.filter((r) => r.status === 'fulfilled').length });
}
