'use client';
export function ThemeToggle() {
  function toggle() {
    const el = document.documentElement;
    const dark = el.classList.toggle('dark');
    try { localStorage.setItem('torc-theme', dark ? 'dark' : 'light'); } catch {}
  }
  return (
    <button onClick={toggle} className="grid size-9 place-items-center rounded-full text-text-2 hover:text-text" aria-label="Toggle light or dark theme" title="Theme">
      <svg viewBox="0 0 20 20" className="size-[18px]" aria-hidden>
        <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 3a7 7 0 0 1 0 14z" fill="currentColor" />
      </svg>
    </button>
  );
}
