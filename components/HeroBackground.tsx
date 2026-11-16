// Hero background, three layers:
//   1. Aurora "club lights" — always on, zero bytes, looks good even with no events.
//   2. Live poster wall — real posters of tonight / upcoming events sliding by.
//   3. Video — only used when there aren't enough posters yet (e.g. very first days).
//      Swap the clip by replacing public/video/hero-bg.mp4 (dark, slow, ~5–10 s, < 2 MB).
import React, { useMemo } from 'react';
import type { AppEvent } from '../types';
import { tonightYMD } from '../lib/dates';

const MIN_POSTERS = 4;

export const HeroBackground: React.FC<{ events: AppEvent[]; loading: boolean }> = ({ events, loading }) => {
  const posters = useMemo(() => {
    const today = tonightYMD();
    const seen = new Set<string>();
    const list: string[] = [];
    const sorted = [...events]
      .filter((e) => e.date >= today && e.image && /^https?:/.test(e.image))
      .sort((a, b) => Number(!!b.isPromoted) - Number(!!a.isPromoted) || a.date.localeCompare(b.date));
    for (const e of sorted) {
      if (!seen.has(e.image)) {
        seen.add(e.image);
        list.push(e.image);
      }
      if (list.length >= 18) break;
    }
    return list;
  }, [events]);

  const showWall = posters.length >= MIN_POSTERS;
  const showVideo = !loading && !showWall;

  // Fill each row to at least 8 posters, then duplicate for a seamless loop.
  const rows = useMemo(() => {
    if (!showWall) return [];
    const fill = (offset: number) => {
      const out: string[] = [];
      for (let i = 0; out.length < 8; i++) out.push(posters[(i + offset) % posters.length]);
      return [...out, ...out];
    };
    return [fill(0), fill(Math.ceil(posters.length / 3)), fill(Math.ceil((posters.length * 2) / 3))];
  }, [posters, showWall]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* 1. Aurora */}
      <div className="absolute inset-0 bg-night-bg" />
      <div className="absolute -left-[20%] top-[-10%] h-[70vh] w-[70vh] rounded-full bg-night-accent/40 blur-[110px] animate-blob" />
      <div className="absolute -right-[15%] top-[10%] h-[65vh] w-[65vh] rounded-full bg-night-accent2/40 blur-[120px] animate-blob [animation-delay:-6s]" />
      <div className="absolute bottom-[-20%] left-[25%] h-[60vh] w-[60vh] rounded-full bg-[#ff8a5b]/25 blur-[120px] animate-blob [animation-delay:-11s]" />
      {/* laser beams */}
      <div className="absolute left-1/2 top-[-30%] h-[160%] w-[140%] -translate-x-1/2 opacity-[0.18]">
        <div className="absolute inset-0 origin-top animate-[beam_9s_ease-in-out_infinite] bg-[conic-gradient(from_180deg_at_50%_0%,transparent_0deg,rgba(255,61,127,.9)_6deg,transparent_12deg,transparent_40deg,rgba(124,92,255,.9)_46deg,transparent_52deg,transparent_300deg,rgba(255,138,91,.8)_306deg,transparent_312deg)]" />
      </div>

      {/* 2. Poster wall */}
      {showWall && (
        <div className="absolute inset-0 animate-[fadeIn_1.2s_ease-out_both]">
          <div className="absolute left-1/2 top-1/2 flex w-[180%] -translate-x-1/2 -translate-y-1/2 -rotate-[10deg] flex-col gap-4 opacity-[0.55] md:w-[140%] md:gap-5">
            {rows.map((row, r) => (
              <div key={r} className="flex w-max gap-4 md:gap-5" style={{ animation: `marquee ${70 + r * 18}s linear infinite ${r % 2 ? 'reverse' : ''}` }}>
                {row.map((src, i) => (
                  <img
                    key={`${r}-${i}`}
                    src={src}
                    alt=""
                    loading={i < 6 ? 'eager' : 'lazy'}
                    decoding="async"
                    className="aspect-[3/4] w-[120px] shrink-0 rounded-2xl object-cover shadow-2xl ring-1 ring-white/10 md:w-[190px]"
                  />
                ))}
              </div>
            ))}
          </div>
          {/* neon tint over the posters */}
          <div className="absolute inset-0 bg-gradient-to-tr from-night-accent/25 via-transparent to-night-accent2/30 mix-blend-color" />
        </div>
      )}

      {/* 3. Video fallback */}
      {showVideo && (
        <video autoPlay muted loop playsInline preload="metadata" poster="/video/hero-poster.jpg" className="absolute inset-0 h-full w-full object-cover opacity-35 mix-blend-screen">
          <source src="/video/hero-bg.mp4" type="video/mp4" />
        </video>
      )}

      {/* legibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-night-bg/80 via-night-bg/45 to-night-bg" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_60%,rgba(7,6,13,.75),transparent_60%)]" />
    </div>
  );
};
