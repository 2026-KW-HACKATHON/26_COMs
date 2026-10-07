import type { ReactNode } from 'react';

// 개인정보처리방침. Google 로그인 앱 게시(OAuth 동의 화면)에 이 주소(/privacy)를 넣는다.
// 앱이 실제로 모으는 정보가 바뀌면(supabase/schema.sql, src/lib/social.ts의 로그인 동의 항목 등) 여기도 함께 고친다.
const UPDATED = '2026년 10월 8일';
/** 문의처. 팀 이메일이 생기면 mailto: 주소로 바꾼다 */
const CONTACT = { label: 'GitHub 2026-KW-HACKATHON/26_COMs', href: 'https://github.com/2026-KW-HACKATHON/26_COMs/issues' };

export default function Privacy() {
  return (
    <article className="flex flex-col w-full pt-4 pb-10 gap-6 text-body-sm text-gray-700">
      <header>
        <p className="text-label-md text-on-surface-variant">시행일 {UPDATED}</p>
        <p className="mt-3">
          기억캡슐(이하 &lsquo;서비스&rsquo;)은 2026 광운대학교 해커톤 팀이 만든 동네 가게 방문 기록 서비스입니다. 서비스는 필요한 정보만 모으고,
          아래 목적 밖으로 쓰거나 다른 곳에 팔지 않습니다.
        </p>
      </header>

      <Section title="1. 모으는 정보">
        <Table
          rows={[
            ['로그인 (카카오)', '닉네임, 프로필 사진, 카카오 회원 번호'],
            ['로그인 (Google)', '이름, 이메일 주소, 프로필 사진, Google 계정 번호'],
            ['직접 입력', '아이디, 표시 이름'],
            ['영상을 남길 때', '5초 영상과 썸네일, 고른 가게, 남긴 시각, 태그한 친구, 공개 범위(친구만·동네 모두), 현장 인증 여부'],
            ['친구·조르기', '친구 요청·수락 관계, 보낸·받은 조르기와 읽은 시각'],
            ['폰 알림을 켰을 때', '기기의 알림 구독 정보(브라우저가 만든 알림 주소와 암호화 키)'],
          ]}
        />
        <p>
          이메일 주소는 로그인 확인에만 쓰고 다른 사용자에게 보여 주지 않습니다. 앱에서 촬영하면 기기 위치(GPS)로 가게에서 100m 안인지 확인해 &lsquo;현장 인증&rsquo; 여부만 저장하고, 위치 좌표는 서버에 보내거나 저장하지 않습니다. 카메라와 마이크는 촬영할 때만 쓰고,
          녹화한 5초 영상만 저장합니다.
        </p>
      </Section>

      <Section title="2. 쓰는 목적">
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>로그인과 계정 관리</li>
          <li>영상 저장과 재생, 친구·태그·피드·지도 보여 주기</li>
          <li>조르기·회상(&lsquo;한 달 전 오늘&rsquo;) 알림 보내기</li>
          <li>동네 랭킹: 가게별 방문 수를 숫자로만 집계 (누가 남겼는지는 공개하지 않음)</li>
        </ul>
      </Section>

      <Section title="3. 누가 볼 수 있나요">
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>영상은 기본으로 본인, 수락된 친구, 그 영상에 태그된 사람만 봅니다.</li>
          <li>&lsquo;동네 모두&rsquo;로 공개한 영상은 로그인한 사용자 모두가 봅니다. 이때도 태그된 친구는 원래 볼 수 있던 사람에게만 보입니다.</li>
          <li>아이디·표시 이름·프로필 사진은 친구, 요청을 주고받은 사람, 같은 영상에 나온 사람, 동네 공개 영상을 본 사람에게 보입니다.</li>
          <li>동네 랭킹은 가게별 숫자만 누구나(로그인하지 않아도) 봅니다.</li>
        </ul>
      </Section>

      <Section title="4. 보관 기간과 삭제">
        <p>
          계정을 삭제할 때까지 보관합니다. 영상은 영상 화면에서 언제든 지울 수 있고, 지우면 영상 파일과 태그도 함께 바로 지워집니다. 친구 관계는 친구 화면에서
          끊을 수 있고, 폰 알림은 알림 화면에서 끄면(또는 로그아웃하면) 구독 정보가 지워집니다. 계정 삭제를 원하면 아래 문의처로 알려 주세요. 계정을 지우면
          그 계정의 영상·친구·조르기·알림 정보가 모두 지워집니다.
        </p>
      </Section>

      <Section title="5. 맡기는 곳 (처리 위탁·국외 이전)">
        <Table
          rows={[
            ['Supabase', '계정·데이터베이스·영상 파일 저장'],
            ['Vercel (미국)', '앱 배포와 알림 서버 실행'],
            ['브라우저 알림 서비스 (Google·Apple·Mozilla·Microsoft)', '폰 알림을 켠 기기로 알림 전달 (알림 문구에 가게 이름·친구 이름이 들어감)'],
            ['Google Fonts', '아이콘 글꼴 내려받기 (접속 정보만 전달)'],
          ]}
        />
        <p>지도는 OpenStreetMap 데이터를 앱 안에 넣어 그려서, 지도를 볼 때 외부로 위치를 보내지 않습니다.</p>
      </Section>

      <Section title="6. 기기에 저장하는 것">
        <p>
          로그인 상태, 오프라인으로 열기 위한 앱 파일, 닫은 회상 카드 표시를 브라우저 저장소에 둡니다. 브라우저의 사이트 데이터 삭제로 지울 수 있습니다.
        </p>
      </Section>

      <Section title="7. 만 14세 미만">
        <p>만 14세 미만은 서비스에 가입할 수 없습니다.</p>
      </Section>

      <Section title="8. 문의">
        <p>
          개인정보 관련 문의·열람·정정·삭제 요청은{' '}
          <a href={CONTACT.href} target="_blank" rel="noreferrer" className="font-semibold text-primary underline underline-offset-2">
            {CONTACT.label}
          </a>
          로 보내 주세요. 방침이 바뀌면 이 페이지에 시행일과 함께 알립니다.
        </p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-headline-sm text-on-surface">{title}</h3>
      {children}
    </section>
  );
}

function Table({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="rounded-2xl bg-surface-container-low divide-y divide-gray-100">
      {rows.map(([k, v]) => (
        <div key={k} className="px-4 py-2.5 flex flex-col gap-0.5">
          <dt className="text-label-md font-bold text-on-surface">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
