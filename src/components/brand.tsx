import Link from "next/link";

export function BrandMark({
  size = 36,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={`brand-mark ${className}`}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="jugaad-j-grad" x1="38" y1="6" x2="14" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF7A00" />
          <stop offset="60%" stopColor="#FF633A" />
          <stop offset="100%" stopColor="#E5483F" />
        </linearGradient>
      </defs>

      {/* 3 audio signal bars on the left */}
      <rect x="4" y="24" width="3.5" height="10" rx="1.75" fill="#FF7A00" />
      <rect x="10.5" y="18" width="3.5" height="16" rx="1.75" fill="#FF7A00" />
      <rect x="17" y="12" width="3.5" height="22" rx="1.75" fill="#FF7A00" />

      {/* Dynamic J sweeping into shopping cart base */}
      <path
        d="M26 8L39 5.5L34 26C32.5 32 29 37 21 37H11C7 37 5 34 7 30C9 26 13 24 17 24H25L28 10L26 8Z"
        fill="url(#jugaad-j-grad)"
      />

      {/* Crisp shopping cart inside base */}
      <g transform="translate(14, 26) scale(0.65)" fill="#FFFFFF">
        <path d="M1 1H4L6.5 13H15L17.5 4H5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx="8" cy="16" r="1.5" fill="#FFFFFF" />
        <circle cx="14" cy="16" r="1.5" fill="#FFFFFF" />
      </g>
    </svg>
  );
}

export function Wordmark({
  size = 32,
  showTagline = false,
  className = "",
}: {
  size?: number;
  showTagline?: boolean;
  className?: string;
}) {
  return (
    <Link className={`brand-wordmark inline-flex items-center gap-2.5 ${className}`} href="/">
      <BrandMark size={size} />
      <span className="brand-wordmark__text flex items-baseline font-display font-extrabold text-[1.35rem] tracking-tight leading-none text-[#1F1F1F]">
        Jugaad<span className="text-[#FF7A00] ml-1">One</span>
      </span>
      {showTagline && (
        <span className="hidden sm:inline-block text-xs text-[#6F6B65] font-medium border-l border-[#E5DDD0] pl-2.5 ml-1">
          Say it. Find it. Pay for it.
        </span>
      )}
    </Link>
  );
}
