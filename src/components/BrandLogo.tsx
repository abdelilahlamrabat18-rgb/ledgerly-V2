export function BrandLogo({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      role="img"
      aria-hidden="true"
    >
      <rect x="0.5" y="0.5" width="63" height="63" rx="14" fill="#F47B46" />
      <g transform="translate(16, 12)">
        <path
          d="M4 24v-18h18"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="4" y="16" width="3.5" height="12" rx="0.75" fill="white" />
        <rect x="10.5" y="10" width="3.5" height="18" rx="0.75" fill="white" />
        <rect x="17" y="6" width="3.5" height="22" rx="0.75" fill="white" />
        <rect x="23.5" y="2" width="3.5" height="26" rx="0.75" fill="white" />
        <path
          d="M23.5 2 L17 6 L10.5 10 L4 16"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
    </svg>
  );
}

export default BrandLogo;