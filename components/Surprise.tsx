// "Më surprizo 🎲" — slot-machine style random pick from the current filters.
import React, { useEffect, useRef, useState } from 'react';
import type { AppEvent } from '../types';
import { categoryIcon, useI18n } from '../lib/i18n';
import { relativeLabel } from '../lib/dates';
import { FALLBACK_IMAGE, priceLabel } from './EventCard';
import { burstConfetti, Icon, useLockBody } from './ui';

export const SurpriseModal: React.FC<{ pool: AppEvent[]; onClose: () => void; onOpen: (e: AppEvent) => void }> = ({ pool, onClose, onOpen }) => {
  const { t, cat, lang } = useI18n();
  const [idx, setIdx] = useState(0);
  const [spinning, setSpinning] = useState(true);
  const timers = useRef<number[]>([]);
  const resultRef = useRef<HTMLDivElement>(null);
  useLockBody(true);

  const spin = () => {
    if (!pool.length) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setSpinning(true);
    // Premium events get a slightly higher chance
    const weighted = pool.flatMap((e) => (e.isPromoted ? [e, e] : [e]));
    const target = pool.indexOf(weighted[Math.floor(Math.random() * weighted.length)]);
    const steps = 14 + Math.floor(Math.random() * 4);
    let tAcc = 0;
    for (let i = 0; i < steps; i++) {
      tAcc += 40 + i * i * 0.9; // slows down like a wheel (~2 s total)
      const showIdx = i === steps - 1 ? target : Math.floor(Math.random() * pool.length);
      timers.current.push(window.setTimeout(() => setIdx(showIdx), tAcc));
    }
    timers.current.push(
      window.setTimeout(() => {
        setSpinning(false);
        const r = resultRef.current?.getBoundingClientRect();
        if (r) burstConfetti(r.left + r.width / 2, r.top + r.height / 3);
      }, tAcc + 80)
    );
  };

  useEffect(() => {
    spin();
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const e = pool[idx];

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/80 p-5 backdrop-blur-md" onClick={onClose}>
      <div className="w-full max-w-sm animate-scale-in" onClick={(ev) => ev.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('surprise.btn')}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-white">🎲 {t('surprise.title')}</h2>
          <button onClick={onClose} className="text-night-muted hover:text-white" aria-label="Close">
            <Icon.Close />
          </button>
        </div>

        {!e ? (
          <p className="rounded-3xl border border-night-line bg-night-surface p-8 text-center text-night-muted">{t('surprise.none')}</p>
        ) : (
          <>
            <div
              ref={resultRef}
              className={`relative aspect-[4/5] overflow-hidden rounded-[28px] ring-2 transition-all duration-300 ${
                spinning ? 'scale-[0.97] ring-white/10' : 'scale-100 ring-night-accent shadow-glow'
              }`}
            >
              <img src={e.image || FALLBACK_IMAGE} alt="" className={`absolute inset-0 h-full w-full object-cover ${spinning ? 'blur-[2px]' : ''}`} />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-night-accent px-2.5 py-1 text-[11px] font-bold uppercase text-white">{relativeLabel(e.date, lang)}</span>
                  <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                    {categoryIcon(e.type)} {cat(e.type)}
                  </span>
                  <span className="rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-bold text-white">{priceLabel(e.price, t('card.free'))}</span>
                </div>
                <div className="font-display text-2xl font-bold leading-tight text-white">{e.name}</div>
                <div className="mt-1 text-sm text-white/75">
                  📍 {e.venue}, {e.city}
                  {e.time ? ` · ${e.time}` : ''}
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={spin} disabled={spinning} className="btn-ghost whitespace-nowrap !px-3 !py-3.5 text-sm">
                {t('surprise.again')}
              </button>
              <button onClick={() => onOpen(e)} disabled={spinning} className="btn-primary whitespace-nowrap !px-3 !py-3.5 text-sm">
                {t('surprise.go')} →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
