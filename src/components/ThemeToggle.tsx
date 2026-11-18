'use client';
export function ThemeToggle() {
  function toggle() {
    const el = document.documentElement;
    const dark = el.classList.toggle('dark');
    try { localStorage.setItem('torc-theme', dark ? 'dark' : 'light'); } catch {}
  }
  return (
    <button onClick={toggle} className="rounded border border-border px-2 py-0.5 text-[12px] hover:bg-surface-2" aria-label="Toggle light or dark theme">
      Theme
    </button>
  );
}
