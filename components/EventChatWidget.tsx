import React, { useEffect, useRef, useState } from 'react';
import type { AppEvent } from '../types';
import { useI18n } from '../lib/i18n';
import { localReply } from '../shared/concierge.js';
import { relativeLabel } from '../lib/dates';
import { FALLBACK_IMAGE, priceLabel } from './EventCard';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  picks?: string[];
}

interface Props {
  position?: 'left' | 'right';
  events: AppEvent[];
  onOpenEvent: (e: AppEvent) => void;
}

export const EventChatWidget: React.FC<Props> = ({ position = 'right', events, onOpenEvent }) => {
  const { t, lang } = useI18n();
  const SUGGESTIONS = [t('chat.s1'), t('chat.s2'), t('chat.s3')];
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpenedOnce, setHasOpenedOnce] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'model', text: t('chat.hello') }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const byId = new Map(events.map((e) => [e.id, e]));

  // Keep the greeting in the current language until the user starts chatting
  useEffect(() => {
    setMessages((m) => (m.length === 1 ? [{ role: 'model', text: t('chat.hello') }] : m));
  }, [lang]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isOpen, isLoading]);

  const send = async (text?: string) => {
    const trimmed = (text ?? input).trim();
    if (!trimmed || isLoading) return;
    const newMessages: ChatMessage[] = [...messages, { role: 'user', text: trimmed }];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    let answer: { reply: string; picks: string[] } | null = null;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch('/api/event-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          message: trimmed,
          history: newMessages.slice(1, -1).map(({ role, text }) => ({ role, text })),
        }),
      });
      clearTimeout(timer);
      const data = await res.json();
      if (data?.reply) answer = { reply: data.reply, picks: Array.isArray(data.picks) ? data.picks : [] };
    } catch {
      /* fall through to the local brain */
    }
    // No connection / slow network: answer from the events already on the page.
    if (!answer) answer = localReply(events as any[], trimmed);

    setMessages((prev) => [...prev, { role: 'model', text: answer!.reply, picks: answer!.picks }]);
    setIsLoading(false);
  };

  const sideClass = position === 'left' ? 'left-5' : 'right-5';
  const showSuggestions = messages.length === 1 && !isLoading;

  return (
    <>
      <button
        onClick={() => {
          setIsOpen((v) => !v);
          setHasOpenedOnce(true);
        }}
        className={`fixed bottom-6 md:bottom-8 ${sideClass} z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-night-accent to-night-accent2 text-white shadow-2xl shadow-rose-950/40 transition-all duration-300 hover:scale-110 active:scale-95 ${
          !hasOpenedOnce ? 'animate-float' : ''
        }`}
        aria-label={t('chat.open')}
      >
        <span className="text-2xl leading-none">{isOpen ? '✕' : '🌙'}</span>
        {!hasOpenedOnce && <span className="absolute -right-1 -top-1 h-3.5 w-3.5 animate-pulse rounded-full border-2 border-night-bg bg-emerald-400" />}
      </button>

      {isOpen && (
        <div
          className={`fixed bottom-24 md:bottom-28 ${sideClass} z-40 flex h-[68vh] max-h-[580px] w-[92vw] max-w-sm flex-col overflow-hidden rounded-3xl border border-white/10 bg-night-card shadow-2xl animate-scale-in`}
          role="dialog"
          aria-label={t('chat.title')}
        >
          <div className="flex items-center gap-2.5 border-b border-white/10 bg-gradient-to-r from-night-accent/20 to-night-accent2/20 px-4 py-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-night-accent to-night-accent2 text-base">🌙</div>
            <div>
              <div className="text-sm font-bold leading-tight text-white">{t('chat.title')}</div>
              <div className="flex items-center gap-1 text-[11px] text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {t('chat.status')}
              </div>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
            {messages.map((m, i) => (
              <div key={i} className="animate-fade-in-up">
                <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                      m.role === 'user' ? 'rounded-br-sm bg-night-accent text-white' : 'rounded-bl-sm border border-white/5 bg-white/5 text-gray-100'
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
                {m.picks && m.picks.length > 0 && (
                  <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
                    {m.picks
                      .map((id) => byId.get(id))
                      .filter(Boolean)
                      .map((e) => (
                        <button
                          key={e!.id}
                          onClick={() => onOpenEvent(e!)}
                          className="group flex w-[210px] shrink-0 items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-left transition hover:bg-white/[0.08] active:scale-[0.98]"
                        >
                          <img src={e!.image || FALLBACK_IMAGE} alt="" className="h-14 w-11 shrink-0 rounded-xl object-cover" />
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-bold text-white">
                              {e!.isPromoted ? '⭐ ' : ''}
                              {e!.name}
                            </span>
                            <span className="block truncate text-[11px] text-night-muted">
                              {e!.venue} · {relativeLabel(e!.date, lang)}
                              {e!.time ? ` ${e!.time}` : ''}
                            </span>
                            <span className="block text-[11px] font-semibold text-night-accent">{priceLabel(e!.price, t('card.free'))} →</span>
                          </span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            ))}

            {showSuggestions && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-gray-300 transition hover:bg-white/10 hover:text-white"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-white/5 bg-white/5 px-3.5 py-2.5 text-gray-400">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2 border-t border-white/10 bg-black/20 p-2.5"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('chat.placeholder')}
              maxLength={500}
              enterKeyHint="send"
              className="flex-1 rounded-xl border border-white/10 bg-night-bg px-3 py-2.5 text-sm text-white placeholder-gray-500 transition focus:border-night-accent focus:outline-none"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              aria-label="Send"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-night-accent text-white transition hover:bg-rose-600 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ➤
            </button>
          </form>
        </div>
      )}
    </>
  );
};
