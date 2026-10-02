# 기억캡슐

사라지는 동네의 추억을 **5초 영상**으로 남기는 지도 기반 기록 서비스.
서울 노원구 월계1동 식당·카페 지도에서 가게를 고르고, 그곳에서의 5초를 남긴 뒤 마이로그에서 다시 본다.

## 기술 스택

| 영역 | 선택 | 이유 |
| --- | --- | --- |
| 앱 형태 | 모바일 웹앱 (PWA) | 기획의 1차 타깃이 모바일 웹 이용자. 설치·심사 없이 링크로 바로 쓰고, 홈 화면에 추가하면 앱처럼 전체 화면으로 실행 |
| 프론트엔드 | React 19 · TypeScript · Vite · Tailwind CSS · React Router | |
| 지도 | Leaflet + OpenStreetMap | API 키·호출 비용 없음 (기획서 리스크: 지도 API 호출량·비용) |
| 영상 | MediaRecorder | 앱 안에서 5초 자동 촬영, 앨범 영상은 5초 구간 선택 |
| 저장·계정 | Supabase (Postgres · Storage · Auth) | 무료 요금제, 행 보안 정책(RLS)으로 본인 기록만 접근, 익명 계정으로 가입 없이 시작 |
| 배포 | Vercel | 카메라는 HTTPS에서만 동작, PR마다 미리보기 주소 |

## 시작하기

```bash
npm install
npm run dev
```

Supabase를 설정하지 않으면 영상은 각자 기기 브라우저(IndexedDB)에만 저장된다. 저장 방식은 [src/lib/capsuleStore.ts](src/lib/capsuleStore.ts)가 환경변수를 보고 고른다.

## Supabase 연결 (서버 저장)

1. [supabase.com](https://supabase.com)에서 새 프로젝트를 만든다 (Region: Northeast Asia (Seoul)).
2. SQL Editor에 [supabase/schema.sql](supabase/schema.sql)을 붙여넣고 실행한다.
3. Authentication > Sign In / Providers에서 **Allow anonymous sign-ins**를 켠다.
4. `.env.example`을 `.env.local`로 복사하고 Project Settings의 Project URL과 Publishable key를 넣는다.
5. `npm run dev`를 다시 실행한다. 마이로그의 "이 기기 브라우저에만 저장돼요" 문구가 사라지면 서버 저장 모드다.

처음 영상을 남길 때 익명 계정이 만들어지고, 그 브라우저에서만 자기 기록을 볼 수 있다. 앨범 영상은 무료 요금제 파일 한도 때문에 50MB까지 올릴 수 있다.

## 배포 (Vercel)

1. [vercel.com](https://vercel.com)에서 이 GitHub 저장소를 Import한다 (Vite 자동 인식).
2. Environment Variables에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`를 넣는다.
3. 배포된 https 주소를 폰으로 열고 공유 메뉴에서 **홈 화면에 추가**하면 앱처럼 실행된다.

Organization 저장소에 Vercel GitHub 앱을 설치할 권한이 없으면 로컬에서 `npx vercel`로 배포할 수 있다.

## 폰에서 테스트할 때

- 카메라 촬영은 https 또는 localhost에서만 된다. `npm run dev -- --host`로 띄운 LAN 주소(http)에서는 앨범 업로드만 된다.
- 서비스 워커(오프라인 캐시)는 `npm run build && npm run preview` 또는 배포 주소에서만 동작한다.

## 데이터·아이콘 갱신

- 월계1동 가게 목록: `node scripts/fetch-places.mjs` (OpenStreetMap)
- 앱 아이콘: [public/favicon.svg](public/favicon.svg)를 고친 뒤 `npx @vite-pwa/assets-generator@1`
