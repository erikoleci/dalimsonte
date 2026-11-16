import React, { useState, useRef, useEffect } from 'react';
import { useI18n } from '../lib/i18n';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

interface EventChatWidgetProps {
  /** Which side of the screen the launcher button sits on */
  position?: 'left' | 'right';
}


export const EventChatWidget: React.FC<EventChatWidgetProps> = ({ position = 'right' }) => {
  const { t, lang } = useI18n();
  const SUGGESTIONS = [t('chat.s1'), t('chat.s2'), t('chat.s3')];
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpenedOnce, setHasOpenedOnce] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: t('chat.hello') },
  ]);
  // Keep the greeting in the current language until the user starts chatting
  useEffect(() => {
    setMessages((m) => (m.length === 1 ? [{ role: 'model', text: t('chat.hello') }] : m));
  }, [lang]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isOpen]);

  const send = async (text?: string) => {
    const trimmed = (text ?? input).trim();
    if (!trimmed || isLoading) return;

    const newMessages: ChatMessage[] = [...messages, { role: 'user', text: trimmed }];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/event-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history: newMessages.slice(1, -1) }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: 'model', text: data.reply || t('chat.error') }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'model', text: t('chat.error') }]);
    } finally {
      setIsLoading(false);
    }
  };

  const sideClass = position === 'left' ? 'left-5' : 'right-5';
  const showSuggestions = messages.length === 1 && !isLoading;

  return (
    <>
      <button
        onClick={() => { setIsOpen((v) => !v); setHasOpenedOnce(true); }}
        className={`fixed bottom-6 md:bottom-8 ${sideClass} z-40 w-14 h-14 rounded-full bg-gradient-to-br from-night-accent to-night-accent2 text-white shadow-2xl shadow-rose-950/40 flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 ${!hasOpenedOnce ? 'animate-float' : ''}`}
        aria-label={t('chat.open')}
      >
        <span className="text-2xl leading-none">{isOpen ? '✕' : '🌙'}</span>
        {!hasOpenedOnce && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-night-bg animate-pulse" />
        )}
      </button>

      {isOpen && (
        <div
          className={`fixed bottom-24 md:bottom-28 ${sideClass} z-40 w-[92vw] max-w-sm h-[65vh] max-h-[540px] bg-night-card border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-in`}
        >
          <div className="px-4 py-3.5 bg-gradient-to-r from-night-accent/20 to-indigo-600/20 border-b border-white/10 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-night-accent to-night-accent2 flex items-center justify-center text-sm shrink-0">🌙</div>
            <div>
              <div className="text-sm font-bold text-white leading-tight">{t('chat.title')}</div>
              <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> {t('chat.status')}
              </div>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-night-accent text-white rounded-br-sm'
                      : 'bg-white/5 text-gray-100 rounded-bl-sm border border-white/5'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}

            {showSuggestions && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-[11px] px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/5 text-gray-400 px-3.5 py-2.5 rounded-2xl rounded-bl-sm flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" />
                </div>
              </div>
            )}
          </div>

          <div className="p-2.5 border-t border-white/10 flex items-center gap-2 bg-black/20">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder={t('chat.placeholder')}
              className="flex-1 bg-night-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-night-accent transition"
            />
            <button
              onClick={() => send()}
              disabled={isLoading || !input.trim()}
              className="w-9 h-9 rounded-lg bg-night-accent hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center shrink-0 transition active:scale-90"
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
};
