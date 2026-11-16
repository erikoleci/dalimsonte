import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ADMIN_CONTACT, CATEGORIES, CITIES, LIMITS } from '../shared/constants.js';
import { useI18n } from '../lib/i18n';
import { tonightYMD } from '../lib/dates';
import { db, uploadEventImages } from '../services/supabase';
import { Icon, Turnstile } from './ui';

const emptyForm = () => ({
  venue: '',
  name: '',
  city: 'Tiranë',
  date: tonightYMD(),
  time: '22:00',
  type: 'Techno/House',
  description: '',
  price: '',
  phone: '',
  instagram: '',
  artists: '',
  wantsPromotion: false,
  acceptedTerms: false,
});

export const VenueForm: React.FC<{ onCancel: () => void }> = ({ onCancel }) => {
  const { t, lang } = useI18n();
  const [form, setForm] = useState(emptyForm);
  const [files, setFiles] = useState<File[]>([]);
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [status, setStatus] = useState<'idle' | 'uploading' | 'sending'>('idle');
  const [error, setError] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const hasCaptcha = !!import.meta.env.VITE_TURNSTILE_SITE_KEY;

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  useEffect(() => window.scrollTo({ top: 0 }), [step]);

  const set = <K extends keyof ReturnType<typeof emptyForm>>(k: K, v: ReturnType<typeof emptyForm>[K]) => setForm((f) => ({ ...f, [k]: v }));

  const valid =
    form.venue.trim() && form.name.trim() && form.description.trim() && form.phone.trim().length >= 6 && form.acceptedTerms && (!hasCaptcha || captcha);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!valid) return setError(t('venue.required'));

    let gallery: string[] = [];
    if (files.length) {
      setStatus('uploading');
      try {
        gallery = await uploadEventImages(files);
      } catch (err) {
        console.error(err);
        setStatus('idle');
        return setError(t('venue.photoError'));
      }
    }

    setStatus('sending');
    const res = await db.submitEvent(
      {
        name: form.name.trim(),
        venue: form.venue.trim(),
        city: form.city,
        date: form.date,
        time: form.time || undefined,
        type: form.type,
        description: form.description.trim(),
        price: form.price.trim(),
        phone: form.phone.trim(),
        instagram: form.instagram.trim() || undefined,
        artists: form.artists.trim() || undefined,
        gallery,
        wantsPromotion: form.wantsPromotion,
      },
      { captchaToken: captcha, acceptedTerms: form.acceptedTerms, honeypot }
    );
    setStatus('idle');
    if (!res.ok) return setError(res.error || 'Error');
    setStep('success');
  };

  const reset = () => {
    setForm(emptyForm());
    setFiles([]);
    setStep('form');
    setError('');
  };

  if (step === 'success') {
    return (
      <div className="mx-auto max-w-lg px-5 pb-20 pt-28 text-center animate-fade-in-up">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-night-live/15 text-4xl text-night-live">✓</div>
        <h1 className="font-display text-3xl font-bold text-white">{t('venue.successTitle')}</h1>
        <p className="mt-3 text-night-muted">{t('venue.successSub', { name: form.name })}</p>
        {form.wantsPromotion && (
          <p className="mt-5 rounded-2xl border border-night-gold/30 bg-night-gold/10 p-4 text-sm text-night-gold">★ {t('venue.successPremium')}</p>
        )}
        <a
          href={`https://wa.me/${ADMIN_CONTACT.whatsapp}?text=${encodeURIComponent(`Përshëndetje! Sapo dërgova eventin "${form.name}" (${form.venue}).`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 flex items-center justify-between rounded-3xl border border-night-line bg-night-surface p-5 text-left transition hover:bg-white/[0.05]"
        >
          <div>
            <div className="label !mb-1">{t('venue.adminContact')}</div>
            <div className="text-xl font-bold text-white">{ADMIN_CONTACT.display}</div>
          </div>
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366] text-[#062b16]">
            <Icon.WhatsApp />
          </span>
        </a>
        <button onClick={reset} className="mt-8 text-sm text-night-muted underline-offset-4 hover:text-white hover:underline">
          {t('venue.another')}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl px-5 pb-24 pt-24 md:px-8 animate-fade-in-up" noValidate>
      <button type="button" onClick={onCancel} className="mb-6 flex items-center gap-1 text-sm text-night-muted hover:text-white">
        <Icon.Back className="h-4 w-4" /> {t('venue.cancel')}
      </button>

      <h1 className="font-display text-3xl font-bold text-white md:text-4xl">{t('venue.title')}</h1>
      <p className="mt-2 text-night-muted">{t('venue.sub')}</p>

      <div className="mt-8 space-y-5">
        {/* Honeypot — hidden from humans */}
        <input type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} className="hidden" aria-hidden="true" name="website" />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={`${t('venue.venueName')} *`}>
            <input className="field" maxLength={LIMITS.venue} value={form.venue} onChange={(e) => set('venue', e.target.value)} placeholder="Rooftop Tirana" required />
          </Field>
          <Field label={`${t('venue.eventName')} *`}>
            <input className="field" maxLength={LIMITS.name} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Saturday Night Fever" required />
          </Field>
        </div>

        <Field label={t('venue.artists')}>
          <input className="field" maxLength={LIMITS.artists} value={form.artists} onChange={(e) => set('artists', e.target.value)} placeholder={t('venue.artistsPh')} />
        </Field>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Field label={t('venue.city')}>
            <select className="field" value={form.city} onChange={(e) => set('city', e.target.value)}>
              {CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('venue.date')}>
            <input type="date" className="field" min={tonightYMD()} value={form.date} onChange={(e) => set('date', e.target.value)} />
          </Field>
          <Field label={t('venue.time')} className="col-span-2 md:col-span-1">
            <input type="time" className="field" value={form.time} onChange={(e) => set('time', e.target.value)} />
          </Field>
        </div>

        <Field label={t('venue.type')}>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button type="button" key={c.value} onClick={() => set('type', c.value)} className={`chip ${form.type === c.value ? 'chip-active' : ''}`}>
                {c.icon} {c[lang]}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={t('venue.price')}>
            <input className="field" maxLength={LIMITS.price} value={form.price} onChange={(e) => set('price', e.target.value)} placeholder={lang === 'sq' ? 'p.sh. 1000 LEK ose Falas' : 'e.g. 1000 LEK or Free'} />
          </Field>
          <Field label={`${t('venue.phone')} *`}>
            <input type="tel" inputMode="tel" className="field" maxLength={LIMITS.phone} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="069 12 34 567" required />
          </Field>
        </div>

        <Field label={t('venue.instagram')}>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-night-muted">@</span>
            <input className="field pl-9" maxLength={LIMITS.instagram} value={form.instagram} onChange={(e) => set('instagram', e.target.value)} placeholder="rooftoptirana" autoCapitalize="none" />
          </div>
        </Field>

        <Field label={`${t('venue.description')} *`}>
          <textarea rows={5} className="field resize-y" maxLength={LIMITS.description} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder={t('venue.descPh')} required />
          <div className="mt-1 text-right text-xs text-night-muted">
            {form.description.length}/{LIMITS.description}
          </div>
        </Field>

        <Field label={t('venue.photos')}>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const list = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
              setFiles((prev) => [...prev, ...list].slice(0, LIMITS.maxPhotos));
              e.target.value = '';
            }}
          />
          <div className="grid grid-cols-3 gap-3">
            {previews.map((src, i) => (
              <div key={src} className="group relative aspect-[4/5] overflow-hidden rounded-2xl border border-night-line">
                <img src={src} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setFiles((f) => f.filter((_, j) => j !== i))}
                  className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white"
                  aria-label="Remove"
                >
                  <Icon.Close className="h-4 w-4" />
                </button>
                {i === 0 && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">COVER</span>}
              </div>
            ))}
            {files.length < LIMITS.maxPhotos && (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 text-night-muted transition hover:border-night-accent hover:text-white"
              >
                <span className="text-2xl">📷</span>
                <span className="text-xs font-semibold">
                  {t('venue.addPhotos')} ({files.length}/{LIMITS.maxPhotos})
                </span>
              </button>
            )}
          </div>
        </Field>

        <label className={`relative block cursor-pointer overflow-hidden rounded-3xl border p-5 transition ${form.wantsPromotion ? 'border-night-gold/60 bg-night-gold/10' : 'border-night-gold/25 bg-night-gold/[0.04] hover:border-night-gold/45'}`}>
          <span className="absolute right-0 top-0 rounded-bl-2xl bg-night-gold px-3 py-1 text-[10px] font-extrabold tracking-wider text-black">{t('venue.recommended')}</span>
          <div className="flex items-start gap-4">
            <input type="checkbox" checked={form.wantsPromotion} onChange={(e) => set('wantsPromotion', e.target.checked)} className="mt-1 h-5 w-5 accent-[#ffc94d]" />
            <div>
              <div className="font-display text-lg font-bold text-night-gold">★ {t('venue.premiumTitle')}</div>
              <p className="mt-1 text-sm text-white/70">{t('venue.premiumSub')}</p>
              <p className="mt-2 text-sm font-bold text-night-gold">{t('venue.premiumPrice')}</p>
            </div>
          </div>
        </label>

        <label className="flex cursor-pointer items-start gap-3 text-sm text-white/75">
          <input type="checkbox" checked={form.acceptedTerms} onChange={(e) => set('acceptedTerms', e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#ff3d7f]" />
          <span>
            {t('venue.terms')}{' '}
            <a href="/privacy.html" target="_blank" className="text-night-accent underline underline-offset-2">
              {t('venue.termsLink')}
            </a>{' '}
            {t('venue.termsRest')}
          </span>
        </label>

        <Turnstile onToken={setCaptcha} />

        {error && <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}

        <button type="submit" disabled={status !== 'idle' || !valid} className="btn-primary w-full text-lg">
          {status === 'uploading' ? t('venue.uploading') : status === 'sending' ? t('venue.sending') : `${t('venue.submit')} 🚀`}
        </button>
      </div>
    </form>
  );
};

const Field: React.FC<{ label: string; className?: string; children: React.ReactNode }> = ({ label, className = '', children }) => (
  <div className={className}>
    <span className="label">{label}</span>
    {children}
  </div>
);
