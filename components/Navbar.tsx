import React, { useEffect, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { Icon } from './ui';

interface Props {
  savedCount: number;
  view: string;
  onHome: () => void;
  onSaved: () => void;
  onPublish: () => void;
  installPrompt: any;
  onInstall: () => void;
}

export const Navbar: React.FC<Props> = ({ savedCount, view, onHome, onSaved, onPublish, installPrompt, onInstall }) => {
  const { t, lang, setLang } = useI18n();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 h-16 transition-colors duration-300 ${
        scrolled || view !== 'home' ? 'border-b border-night-line bg-night-bg/80 backdrop-blur-xl' : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 md:px-8">
        <button onClick={onHome} className="group flex shrink-0 items-center gap-2" aria-label="Ku Dalim Sonte? — home">
          <img src="/logo.png" alt="" className="h-8 w-8 shrink-0 object-contain transition group-hover:scale-110 sm:h-9 sm:w-9" />
          <span className="whitespace-nowrap font-display text-[15px] font-bold tracking-tight text-white sm:text-[17px]">
            Ku Dalim <span className="text-night-accent">Sonte?</span>
          </span>
        </button>

        <div className="flex items-center gap-1.5">
          {installPrompt && (
            <button onClick={onInstall} className="hidden rounded-full border border-night-line bg-white/[0.05] px-3.5 py-2 text-sm font-semibold text-white hover:bg-white/10 sm:block">
              📲 {t('nav.install')}
            </button>
          )}
          <button
            onClick={() => setLang(lang === 'sq' ? 'en' : 'sq')}
            className="flex h-10 items-center rounded-full px-2 text-xs sm:px-3 font-bold tracking-wider text-night-muted transition hover:bg-white/[0.07] hover:text-white"
            aria-label={lang === 'sq' ? 'Switch to English' : 'Kalo në shqip'}
          >
            {lang === 'sq' ? 'EN' : 'SQ'}
          </button>
          <button
            onClick={onSaved}
            aria-label={t('nav.saved')}
            className={`relative flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white/[0.07] ${view === 'saved' ? 'text-night-accent' : 'text-white'}`}
          >
            <Icon.Heart filled={view === 'saved'} />
            {savedCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-night-accent px-1 text-[10px] font-bold text-white ring-2 ring-night-bg">
                {savedCount}
              </span>
            )}
          </button>
          {view !== 'venue' && (
            <button onClick={onPublish} aria-label={t('nav.publish')} className="ml-0.5 flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-3.5 py-2.5 text-sm font-bold text-night-bg transition hover:bg-white/90 active:scale-95">
              <Icon.Plus /> <span className="hidden min-[400px]:inline">{t('nav.publishShort')}</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export const Footer: React.FC<{ onPublish: () => void }> = ({ onPublish }) => {
  const { t } = useI18n();
  return (
    <footer className="border-t border-night-line">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-10 text-sm text-night-muted md:flex-row md:px-8">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="" className="h-7 w-7" />
          <span className="font-display font-bold text-white">
            Ku Dalim <span className="text-night-accent">Sonte?</span>
          </span>
        </div>
        <div className="flex items-center gap-5">
          <button onClick={onPublish} className="hover:text-white">
            {t('footer.forVenues')}
          </button>
          <a href="/privacy.html" className="hover:text-white">
            {t('footer.privacy')}
          </a>
          <span>© {new Date().getFullYear()}</span>
        </div>
        <span>{t('footer.made')}</span>
      </div>
    </footer>
  );
};
