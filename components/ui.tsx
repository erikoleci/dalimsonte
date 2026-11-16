import React, { useEffect, useRef } from 'react';
import type { AppNotification } from '../types';

export const Toasts = ({ items }: { items: AppNotification[] }) => (
  <div className="pointer-events-none fixed inset-x-0 top-20 z-[200] flex flex-col items-center gap-2 px-4" aria-live="polite">
    {items.map((n) => (
      <div
        key={n.id}
        className={`animate-slide-up glass pointer-events-auto flex max-w-sm items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-white shadow-2xl ${
          n.type === 'warning' ? 'border-amber-400/40' : n.type === 'info' ? 'border-night-accent2/40' : 'border-night-live/40'
        }`}
      >
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            n.type === 'warning' ? 'bg-amber-400' : n.type === 'info' ? 'bg-night-accent2' : 'bg-night-live'
          }`}
        />
        {n.message}
      </div>
    ))}
  </div>
);

export const Icon = {
  Heart: ({ filled, className = 'h-5 w-5' }: { filled?: boolean; className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7.5-4.6-9.5-9.1C1.1 8.6 3.2 5 6.7 5c2.1 0 3.6 1.2 4.3 2.4.2.3.6.3.8 0C12.5 6.2 14 5 16.1 5c3.5 0 5.6 3.6 4.2 6.9C19.5 16.4 12 21 12 21z" />
    </svg>
  ),
  Share: ({ className = 'h-5 w-5' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 002 2h10a2 2 0 002-2v-5" />
    </svg>
  ),
  Back: ({ className = 'h-5 w-5' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
    </svg>
  ),
  Pin: ({ className = 'h-4 w-4' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7-6.2-7-11.5A7 7 0 0112 2.5a7 7 0 017 7C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  ),
  Clock: ({ className = 'h-4 w-4' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M12 7v5l3 2" />
    </svg>
  ),
  Calendar: ({ className = 'h-4 w-4' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path strokeLinecap="round" d="M8 3v4M16 3v4M3.5 10h17" />
    </svg>
  ),
  Search: ({ className = 'h-5 w-5' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
    </svg>
  ),
  Plus: ({ className = 'h-4 w-4' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
    </svg>
  ),
  Bell: ({ className = 'h-4 w-4' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 16V11a6 6 0 1112 0v5l1.5 2h-15L6 16zM10 20a2 2 0 004 0" />
    </svg>
  ),
  WhatsApp: ({ className = 'h-5 w-5' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18.2a8.2 8.2 0 01-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 01-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 00-.7.3 3 3 0 00-.9 2.2 5.2 5.2 0 001.1 2.7 11.8 11.8 0 004.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z" />
    </svg>
  ),
  Phone: ({ className = 'h-5 w-5' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 4h3l2 5-2.5 1.5a11 11 0 005 5L14 13l5 2v3a2 2 0 01-2 2A15 15 0 013 6a2 2 0 012-2z" />
    </svg>
  ),
  Instagram: ({ className = 'h-5 w-5' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
    </svg>
  ),
  Close: ({ className = 'h-5 w-5' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.2}>
      <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
};

/** Cloudflare Turnstile captcha. Renders nothing if VITE_TURNSTILE_SITE_KEY isn't set. */
export function Turnstile({ onToken }: { onToken: (t: string) => void }) {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!siteKey || !ref.current) return;
    let widgetId: string | undefined;
    const render = () => {
      const ts = (window as any).turnstile;
      if (!ts || !ref.current) return;
      widgetId = ts.render(ref.current, {
        sitekey: siteKey,
        theme: 'dark',
        callback: onToken,
        'expired-callback': () => onToken(''),
      });
    };
    if ((window as any).turnstile) render();
    else {
      const id = 'cf-turnstile-script';
      let s = document.getElementById(id) as HTMLScriptElement | null;
      if (!s) {
        s = document.createElement('script');
        s.id = id;
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        s.async = true;
        document.head.appendChild(s);
      }
      s.addEventListener('load', render);
    }
    return () => {
      try {
        if (widgetId) (window as any).turnstile?.remove(widgetId);
      } catch {}
    };
  }, [siteKey]);

  if (!siteKey) return null;
  return <div ref={ref} className="min-h-[65px]" />;
}

export function useLockBody(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}

/** Re-renders the component every `ms` so countdowns stay live. */
export function useNow(ms = 30000) {
  const [, setTick] = React.useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

/** Small celebratory burst (pure DOM + CSS, no library). */
export function burstConfetti(x: number, y: number) {
  if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#ff3d7f', '#7c5cff', '#ffc94d', '#3ee08f', '#ffffff'];
  const root = document.createElement('div');
  root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:300;overflow:hidden';
  for (let i = 0; i < 28; i++) {
    const p = document.createElement('span');
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 120;
    const size = 5 + Math.random() * 6;
    p.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${size * 0.6}px;border-radius:2px;background:${
      colors[i % colors.length]
    };--dx:${Math.cos(angle) * dist}px;--dy:${Math.sin(angle) * dist - 60}px;--r:${Math.random() * 720 - 360}deg;animation:confetti 900ms cubic-bezier(.2,.7,.3,1) forwards`;
    root.appendChild(p);
  }
  document.body.appendChild(root);
  setTimeout(() => root.remove(), 1000);
}

export const LiveBadge = ({ status, className = '' }: { status: { kind: 'soon' | 'live'; label: string } | null; className?: string }) =>
  status ? (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold backdrop-blur-md ${
        status.kind === 'live' ? 'bg-night-live/90 text-black' : 'bg-black/50 text-white'
      } ${className}`}
    >
      {status.kind === 'live' ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-black" /> : <Icon.Clock className="h-3 w-3" />}
      {status.label}
    </span>
  ) : null;
