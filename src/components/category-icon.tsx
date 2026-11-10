const art = {
  voice: <><path d="M15 25c0-4 3-7 7-7s7 3 7 7v6c0 4-3 7-7 7s-7-3-7-7z" fill="var(--tile-object)"/><path d="M11 30a11 11 0 0 0 22 0m-11 11v4m-5 0h10m-5-23v4"/><path d="M37 22v12m5-9v6" strokeWidth="2.4"/></>,
  food: <><path d="M10 28h36l-2 5c-2 6-7 10-14 10h-4c-7 0-12-4-14-10z" fill="var(--tile-object)"/><path d="M8 28h40M16 34h6m1-13c-4-4 4-6 0-10m9 10c-4-4 4-6 0-10"/></>,
  rides: <><path d="m13 26 3-8c.5-1.5 1.9-2.5 3.5-2.5h17c1.6 0 3 1 3.5 2.5l3 8m-33 8v5c0 1.1.9 2 2 2h4c1.1 0 2-.9 2-2v-1m28-4v5c0 1.1-.9 2-2 2h-4c-1.1 0-2-.9-2-2v-1"/><path d="M10 31c0-3.3 2.7-6 6-6h24c3.3 0 6 2.7 6 6v5c0 1.1-.9 2-2 2H12c-1.1 0-2-.9-2-2z" fill="var(--tile-object)"/><path d="M16 31.5h3m18 0h3"/></>,
  location: <><path d="M41 24c0 9-13 20-13 20S15 33 15 24a13 13 0 0 1 26 0z" fill="var(--tile-object)"/><circle cx="28" cy="24" r="4.5" fill="var(--tile-light)"/></>,
  wallet: <><path d="M13 23v-3c0-2 1-3 3-4l19-5 3 10" fill="var(--tile-light)"/><rect x="11" y="20" width="34" height="23" rx="5" fill="var(--tile-object)"/><path d="M45 27h-9a5 5 0 0 0 0 10h9z" fill="var(--tile-light)"/><circle cx="36.5" cy="32" r=".9" fill="currentColor" stroke="none"/></>,
  receipt: <><path d="M17 12h22v32l-5.5-3-5.5 3-5.5-3-5.5 3z" fill="var(--tile-object)"/><path d="M22 29h12m-12 5h8m-5-12 2.5 2.5L32 20"/></>,
};

export function CategoryIcon({ kind, className = "" }: { kind: keyof typeof art; className?: string }) {
  return (
    <span className={`category-icon category-icon--${kind} ${className}`} aria-hidden="true">
      <svg viewBox="0 0 56 56" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">{art[kind]}</svg>
    </span>
  );
}
