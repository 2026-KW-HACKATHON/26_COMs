import { titleLabel, type Title, type TierId } from '../lib/titles';

// 등급마다 옅은 바탕 + 진한 글씨 (작은 글씨도 대비 4.5:1 이상)
const TIER_STYLE: Record<TierId, { className: string; icon: string }> = {
  bronze: { className: 'bg-[#FBEEE4] text-[#9A5428]', icon: 'workspace_premium' },
  silver: { className: 'bg-gray-100 text-gray-700', icon: 'workspace_premium' },
  gold: { className: 'bg-[#FFF3D1] text-[#8A5A00]', icon: 'workspace_premium' },
  platinum: { className: 'bg-[#DFF5F0] text-[#0F7565]', icon: 'workspace_premium' },
  diamond: { className: 'bg-[#ECEBFF] text-[#5244D4]', icon: 'diamond' },
};

interface TitleBadgeProps {
  title: Title;
  size?: 'sm' | 'md';
  className?: string;
}

/** 프로필 이름 오른쪽에 붙는 칭호 "가게 이름 + 등급". 자리가 모자라면 가게 이름이 줄고 아이콘·등급은 남는다 */
export default function TitleBadge({ title, size = 'sm', className = '' }: TitleBadgeProps) {
  const style = TIER_STYLE[title.tier.id];
  const sizing = size === 'md' ? 'h-6 pl-1.5 pr-2 gap-1 text-[12px]' : 'h-5 pl-1 pr-1.5 gap-[3px] text-[11px]';
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold leading-none whitespace-nowrap ${sizing} ${style.className} ${className}`}
      title={`칭호 ${titleLabel(title)} · ${title.visits}번 방문`}
    >
      <span className={`material-symbols-rounded icon-fill shrink-0 ${size === 'md' ? 'text-[15px]' : 'text-[13px]'}`} aria-hidden>
        {style.icon}
      </span>
      <span className="truncate">{title.placeName}</span>
      <span className="shrink-0">{title.tier.name}</span>
    </span>
  );
}
