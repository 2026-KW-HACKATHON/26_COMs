# 왔다감

동네 가게에 남기는 **5초**. 가게에서 그 자리에서 찍은 5초 영상을 지도에 남기는 동네 기록 서비스.
이름은 가게 벽이나 방명록에 남기던 'OO 왔다감'에서 따왔다.
서울 노원구 월계1동 식당·카페 지도에서 가게를 고르고, 그곳에서의 5초를 남긴다. 함께 간 친구를 태그하고, 친구끼리는 서로의 지도를 볼 수 있다.

## 주요 기능

- **지도**: 월계1동 건물 윤곽을 직접 그린 지도. 가게가 있는 건물을 누르면 그 가게가 선택되고, 영상을 남긴 건물은 색이 채워지고 아래로 빛이 번진다(많이 남길수록 연한 살구색 → 진한 주황 5단계). 말풍선 숫자는 그 건물에 남긴 영상 수. 지도를 열면 내 위치(동네 안일 때)를 가게 이름이 보이는 만큼 확대해서 보여 주고 파란 점으로 표시한다. 위치를 허용하지 않았거나 동네 밖이면 가게가 모여 있는 곳을 보여 준다
- **5초 촬영**: 영상은 가게에서 그 자리에서 앱으로 찍은 것만 남긴다(앨범에서 올리기 없음). 버튼을 누르면 촬영, 다시 누르면 멈춘다(최소 1초). 멈추지 않으면 5초에 자동 종료
- **로그인**: 카카오·Google 계정. 영상은 계정에 저장되어 다른 기기에서도 보인다
- **친구**: 아이디·이름으로 검색해 친구 요청 → 상대가 수락하면 친구
- **태그**: 영상을 남길 때 함께한 친구를 검색해서 태그(인스타그램처럼). 태그된 친구의 지도·MY에도 나타난다
- **친구 지도**: 홈 상단에서 친구를 고르면 그 친구가 남긴(또는 태그된) 영상이 지도에 표시된다
- **동네 지도·랭킹**: 홈 상단의 "동네"를 고르면(로그인하지 않았으면 처음부터) 동네 사람 모두의 최근 30일 방문 수로 지도가 칠해지고 1~3위에 메달이 붙는다. 지도 아래 카드와 가게 시트에서 동네 순위를 보고, `/ranking`에서 전체 랭킹(최근 30일·전체)을 본다. 방문 = 영상에 나온 사람(태그 포함) × 날짜라서 같은 날 영상을 몰아 올려도 한 번이고, 다른 날 다시 오면 오른다. 다른 날 두 번 이상 온 사람은 단골로 센다. 숫자만 공개되고 영상·누가 남겼는지는 공개되지 않아서 로그인 없이 볼 수 있다(공유 링크로 처음 들어오는 사람용)
- **피드**: 아래 "피드" 탭. 친구 탭은 나와 친구들이, 동네 탭은 동네 사람들이 동네에 공개한 최근 5초를 보여 준다. 화면에 보이는 영상만 불러와 재생한다. 가게 줄을 누르면 동네 지도에서 그 가게
- **하트**: 피드와 영상 화면에서 영상 아래 하트를 누르면 채워지고 숫자가 오른다. 다시 누르면 취소. 영상을 두 번 빠르게 톡 쳐도 하트가 눌린다(인스타그램처럼 가운데 큰 하트가 떴다 사라지고, 이미 눌렀으면 그대로). 볼 수 있는 영상에만 누를 수 있고, 다른 사람에게는 하트 수만 보인다(누가 눌렀는지는 본인만 안다). 이미 Supabase를 쓰고 있다면 [supabase/schema.sql](supabase/schema.sql)을 다시 실행한 뒤 배포한다
- **동네 공개**: 영상을 남길 때(또는 영상 화면에서) "친구만 / 동네 모두"를 고른다. 동네 공개 영상은 로그인한 모두가 피드와 동네 지도의 가게 시트에서 본다. 태그된 친구는 동네 공개여도 원래 볼 수 있던 사람에게만 보인다
- **내 동네 지도 채우기**: MY 탭 위에 "월계1동 174곳 중 N곳 가 봤어요" 진행 막대와 단골 수. 다른 날 2번 간 곳은 지도 이름표에 ⭐, 30일 넘게 안 간 곳은 "오랜만" 표시와 "다시 갈 때 됐어요" 목록
- **회상 알림**: 일주일·한 달·100일·1년 전 오늘 남긴 영상을 피드 맨 위 카드("한 달 전 오늘, ○○분식")와 폰 알림으로 다시 보여 주고 "또 가서 남기기"로 이어 준다
- **조르기**: 같이 간 친구(같은 영상에 함께 나온 친구)에게 영상 화면에서 "여기 또 가자"고 조른다. 받은 친구에게는 앱 위쪽 배너·벨 알림과 폰 알림으로 뜨고, 알림 목록에서 "나도 조르기"로 되조를 수 있다. 같은 친구·같은 가게는 10분에 한 번

공개 범위: 영상은 **본인, 수락된 친구, 태그된 사람**만 볼 수 있다(작성자가 동네 공개로 둔 영상은 로그인한 모두). 하트는 개수만 공개되고 누가 눌렀는지는 본인만 본다. 데이터베이스 행 보안 정책(RLS)이 서버에서 강제한다. 동네 랭킹은 가게별 숫자만 돌려주는 함수(`place_ranking`)로 공개한다.

## 기술 스택

| 영역 | 선택 | 이유 |
| --- | --- | --- |
| 앱 형태 | 모바일 웹앱 (PWA) | 기획의 1차 타깃이 모바일 웹 이용자. 설치·심사 없이 링크로 바로 쓰고, 홈 화면에 추가하면 앱처럼 전체 화면으로 실행 |
| 프론트엔드 | React 19 · TypeScript · Vite · Tailwind CSS · React Router | |
| 지도 | Leaflet + 자체 벡터 지도 (OpenStreetMap·Overture Maps 건물 윤곽) | 지도 타일 이미지 없이 앱에 포함된 데이터(약 40KB)로 그려서 가볍고 오프라인에서도 보인다. API 키·호출 비용 없음 (기획서 리스크: 지도 API 호출량·비용) |
| 영상 | MediaRecorder | 앱 안에서 최대 5초 촬영 (앨범 올리기 없음) |
| 계정·저장 | Supabase (Auth · Postgres · Storage) | 카카오·Google 로그인 내장, RLS로 공개 범위 강제, 무료 요금제 |
| 배포 | Vercel | 카메라는 HTTPS에서만 동작, PR마다 미리보기 주소 |
| 알림 | Supabase Realtime · Web Push (VAPID) · Vercel 서버 함수 | 앱을 보고 있으면 실시간 배너, 닫아 두면 폰 알림. 별도 푸시 서비스 가입 없음 |

## 시작하기

```bash
npm install
npm run dev
```

Supabase를 설정하지 않으면 로그인·친구 기능 없이, 영상은 각자 기기 브라우저(IndexedDB)에만 저장된다(개발·데모용). 저장 방식은 [src/lib/capsuleStore.ts](src/lib/capsuleStore.ts)가 환경변수를 보고 고른다.

## Supabase 연결

1. [supabase.com](https://supabase.com)에서 새 프로젝트를 만든다 (Region: Northeast Asia (Seoul)).
2. SQL Editor에 [supabase/schema.sql](supabase/schema.sql)을 붙여넣고 실행한다. 여러 번 실행해도 된다.
3. `.env.example`을 `.env.local`로 복사하고 Project Settings의 Project URL과 Publishable key를 넣는다.
4. 아래 "로그인 설정"을 마친 뒤 `npm run dev`를 다시 실행한다.

데이터베이스 보안 정책 테스트: `npm run test:db` (메모리 안의 Postgres로 schema.sql을 실행해 공개 범위 규칙을 확인)

## 로그인 설정

공통: 카카오·구글 콘솔의 리다이렉트 URI에는 **`https://<프로젝트>.supabase.co/auth/v1/callback`** 하나만 넣는다 (앱 주소는 넣지 않음).

**Supabase** (Authentication)
- URL Configuration > Site URL: 배포 주소. Redirect URLs: `http://localhost:5173/**`, `http://localhost:4173/**`, `https://<배포 주소>/**`, Vercel 미리보기용 `https://coms-*-com-s.vercel.app/**`
- Sign In / Providers: Google·Kakao 켜기, "Allow new users to sign up" 켜기, "Allow anonymous sign-ins"는 끄기(켜져 있어도 스키마가 차단)
- Kakao 설정의 **Allow users without an email** 켜기 (일반 앱은 이메일 동의항목을 쓸 수 없음)

**카카오** ([developers.kakao.com](https://developers.kakao.com))
- 앱 생성 → REST API 키 = Supabase Client ID, 카카오 로그인 클라이언트 시크릿 = Client Secret
- REST API 키의 카카오 로그인 리다이렉트 URI에 위 Supabase callback 주소
- 카카오 로그인 상태 ON, 동의항목: 닉네임(필수)·프로필 사진
- 앱은 이메일 없이 `profile_nickname,profile_image`만 요청한다 ([src/lib/social.ts](src/lib/social.ts)의 `KAKAO_SCOPE`). 비즈 앱으로 전환해 이메일을 켰다면 `,account_email`을 붙인다
- 오류 코드: KOE205 동의항목 미설정, KOE006 리다이렉트 URI 불일치, KOE101 키 종류 오류, KOE010 시크릿 오류, KOE004 로그인 OFF

**Google** ([console.cloud.google.com](https://console.cloud.google.com) > Google Auth Platform)
- 동의 화면(External) → Clients > 웹 애플리케이션: 승인된 리디렉션 URI에 Supabase callback 주소. 승인된 JavaScript 원본은 비워 둬도 된다 (앱이 Google 스크립트를 직접 부르지 않고 Supabase를 거쳐 이동하는 방식이라 쓰이지 않음)
- 테스트 상태에서는 테스트 사용자만 로그인되므로 시연 전에 앱을 게시(Publish)한다

주의: 카카오톡 안 브라우저에서는 Google 로그인이 막혀 있어 앱이 안내 문구를 띄운다. LAN IP(http://192.168…)로는 로그인 후 돌아오지 못하니 폰 테스트는 Vercel 주소로 한다.

## 배포 (Vercel)

대회 레포는 조직 소유이고 팀원은 외부 협력자라서 Vercel이 레포를 직접 Import할 수 없다. 대신 [.github/workflows/deploy.yml](.github/workflows/deploy.yml)이 GitHub Actions에서 Vercel CLI로 배포한다.

- main에 푸시(머지)하면 실제 주소에 배포된다.
- main으로 가는 PR을 올리면 미리보기 주소가 PR 댓글로 달린다.
- Actions 탭의 "Vercel 배포" → Run workflow로 수동 배포도 된다.

처음 한 번 설정 (Vercel 프로젝트 `com-s/coms`, 무료 플랜):

1. 레포 Settings > Secrets and variables > Actions에 `VERCEL_TOKEN`(Vercel Account Settings > Tokens에서 발급), `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`(로컬에서 `npx vercel link` 후 `.vercel/project.json`)를 넣는다.
2. Vercel 프로젝트 Settings > Environment Variables에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`를 Production·Preview 모두 체크해서 넣는다. 값을 바꾸면 다시 배포해야 반영된다.
3. Settings > Deployment Protection의 Vercel Authentication을 끈다 (켜져 있으면 미리보기 주소를 Vercel 로그인한 사람만 볼 수 있다).
4. Supabase Authentication > URL Configuration에 배포 주소와 미리보기 주소 `https://coms-*-com-s.vercel.app/**`를 추가한다 (위 "로그인 설정" 참고).
5. 배포된 https 주소를 폰으로 열고 공유 메뉴에서 **홈 화면에 추가**하면 앱처럼 실행된다.

로컬에서 바로 올릴 때: `npx vercel`(미리보기) / `npx vercel --prod`(실제 주소). `vercel.json`의 `framework: "vite"`가 없으면 빌드 결과(`dist`) 대신 `public` 폴더가 올라가니 지우지 않는다.

## 폰 알림 (조르기)

조르기는 기본으로 **앱 안 알림**(위쪽 배너·헤더 벨)으로 뜬다. 앱을 닫아 둬도 폰에 뜨게 하려면(웹 푸시) 한 번 설정한다.

1. Supabase SQL Editor에서 [supabase/schema.sql](supabase/schema.sql)을 다시 실행한다 (조르기·알림 구독 테이블, 실시간 알림 등록).
2. 알림 키를 만든다: `npx web-push generate-vapid-keys` → Public Key와 Private Key가 나온다.
3. Vercel 프로젝트 Settings > Environment Variables에 Production·Preview 모두 체크해서 넣고 다시 배포한다.
   - `VITE_VAPID_PUBLIC_KEY`: Public Key
   - `VAPID_PRIVATE_KEY`: Private Key (Sensitive)
   - `SUPABASE_SECRET_KEY`: Supabase Project Settings > API Keys의 Secret key `sb_secret_…` (Sensitive). 알림 서버([api/push.ts](api/push.ts))만 쓰며 앱에는 들어가지 않는다
4. 받는 사람이 앱의 **알림** 화면(화면 오른쪽 위 벨)에서 **폰 알림 켜기**를 누른다.

- 안드로이드 크롬은 브라우저에서 바로 된다. 아이폰은 iOS 16.4 이상에서 **홈 화면에 추가한 앱**에서만 알림을 켤 수 있다.
- 키를 넣지 않으면 폰 알림 켜기 버튼이 나오지 않고 앱 안 알림만 동작한다. `npm run dev`에는 서비스 워커와 `/api`가 없어서 폰 알림은 배포 주소에서 확인한다.
- 로그아웃하면 그 기기로 오던 폰 알림도 끊긴다.

## 회상 알림 (폰 알림)

피드 맨 위 카드는 설정 없이 동작한다. 앱을 닫아 둬도 폰에 "한 달 전 오늘" 알림을 보내려면 위 "폰 알림"을 마친 뒤 한 번 더 설정한다.

1. Vercel 프로젝트 Settings > Environment Variables에 `CRON_SECRET`(아무 긴 무작위 문자열, 예: `openssl rand -hex 32`)을 Production에 넣고 다시 배포한다.
2. [vercel.json](vercel.json)의 크론이 매일 아침 10시(한국 시간, `0 1 * * *` UTC)에 [api/recall.ts](api/recall.ts)를 부른다. Vercel이 `CRON_SECRET`을 `Authorization: Bearer`로 붙여 보내고, 함수는 이 값이 맞을 때만 동작한다. 무료 플랜 크론은 하루 한 번이고 그 시간대 안에서 실행 시각이 조금 달라질 수 있다.
3. 한 사람에게 하루 한 번, 가장 오래된 기념일 영상 하나만 보낸다 (작성자와 태그된 친구 모두에게).

시연할 때는 기다리지 않고 바로 보낼 수 있다: `?days=N`은 N일 전 영상으로 보낸다.

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" "https://26-coms.vercel.app/api/recall?days=1"
```

## 폰에서 테스트할 때

- 카메라 촬영은 https 또는 localhost에서만 된다. `npm run dev -- --host`로 띄운 LAN 주소(http)에서는 촬영이 안 되니, 폰에서 영상 남기기는 Vercel 미리보기 주소로 테스트한다.
- 서비스 워커(오프라인 캐시)는 `npm run build && npm run preview` 또는 배포 주소에서만 동작한다.

## 데이터·아이콘 갱신

- 월계1동 가게 목록: `node scripts/fetch-places.mjs` (OpenStreetMap)
- 월계1동 지도(건물 윤곽·도로·철도·물·공원·지명): `node scripts/fetch-map.mjs` → `src/data/wolgye1-map.json`. OSM에 그려진 건물이 적어서 Overture Maps 건물(OSM + Microsoft 위성 인식)을 함께 쓰는데, 이건 Python 도구가 필요해서 GitHub Actions의 **지도 데이터 갱신** 워크플로로 돌리는 게 편하다 (Actions 탭 → Run workflow, 결과를 같은 브랜치에 자동 커밋). 가게 목록을 갱신한 뒤에도 한 번 돌린다
- 화면 색: 토스처럼 회색 단계 + 강조색 하나. 강조색은 [tailwind.config.js](tailwind.config.js)의 `BRAND`와 [src/lib/theme.ts](src/lib/theme.ts)(캔버스로 그리는 지도용)를 같이 바꾼다. 글꼴은 Pretendard(앱에 포함)
- 앱 아이콘: [public/favicon.svg](public/favicon.svg)를 고친 뒤 `npx @vite-pwa/assets-generator@1`
