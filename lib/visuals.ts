// Canvas helpers: poster colour extraction + Instagram Story image generator.
import type { AppEvent } from '../types';
import type { Lang } from './i18n';
import { longDate } from './dates';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Supabase storage & Unsplash send CORS headers
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

const colorCache = new Map<string, string>();

/** Vivid average colour of a poster, as "r, g, b". Falls back to the brand pink. */
export async function posterColor(src?: string): Promise<string> {
  const fallback = '255, 61, 127';
  if (!src) return fallback;
  if (colorCache.has(src)) return colorCache.get(src)!;
  try {
    const img = await loadImage(src);
    const c = document.createElement('canvas');
    c.width = c.height = 24;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, 24, 24);
    const d = ctx.getImageData(0, 0, 24, 24).data;
    // Weight saturated pixels more so we get the poster's "accent", not grey.
    let r = 0, g = 0, b = 0, w = 0;
    for (let i = 0; i < d.length; i += 4) {
      const max = Math.max(d[i], d[i + 1], d[i + 2]);
      const min = Math.min(d[i], d[i + 1], d[i + 2]);
      const sat = max ? (max - min) / max : 0;
      const weight = 0.05 + sat * sat * (max / 255);
      r += d[i] * weight; g += d[i + 1] * weight; b += d[i + 2] * weight; w += weight;
    }
    let [R, G, B] = [r / w, g / w, b / w];
    // Push brightness/saturation up so it glows on the dark UI
    const mx = Math.max(R, G, B) || 1;
    const boost = 230 / mx;
    [R, G, B] = [R, G, B].map((v) => Math.min(255, Math.round(v * boost)));
    const out = `${R}, ${G}, ${B}`;
    colorCache.set(src, out);
    return out;
  } catch {
    return fallback;
  }
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    } else line = test;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…';
  }
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 1080×1920 PNG for Instagram / WhatsApp / TikTok stories. */
export async function makeStoryImage(e: AppEvent, lang: Lang, siteHost: string): Promise<Blob> {
  const W = 1080, H = 1920;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  try {
    await Promise.all([document.fonts.load('800 80px Unbounded'), document.fonts.load('600 40px Inter')]);
  } catch {}
  // Always keep fallbacks: fonts.check() returns true even when the font isn't registered.
  const display = 'Unbounded, Inter, system-ui, sans-serif';

  // Background
  ctx.fillStyle = '#07060d';
  ctx.fillRect(0, 0, W, H);
  const accent = await posterColor(e.image);
  try {
    if (!e.image) throw new Error('no image');
    const img = await loadImage(e.image);
    const scale = Math.max(W / img.width, H / img.height);
    const iw = img.width * scale, ih = img.height * scale;
    ctx.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih);
  } catch {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, `rgb(${accent})`);
    g.addColorStop(1, '#7c5cff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  const shade = ctx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(7,6,13,0.55)');
  shade.addColorStop(0.35, 'rgba(7,6,13,0.05)');
  shade.addColorStop(0.62, 'rgba(7,6,13,0.75)');
  shade.addColorStop(1, 'rgba(7,6,13,0.98)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);

  // Brand
  ctx.textBaseline = 'top';
  ctx.font = `700 46px ${display}`;
  const brandW = ctx.measureText('Ku Dalim Sonte?').width;
  ctx.fillStyle = 'rgba(7,6,13,0.55)';
  roundRect(ctx, 52, 86, brandW + 56, 100, 50);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Ku Dalim ', 80, 110);
  const kd = ctx.measureText('Ku Dalim ').width;
  ctx.fillStyle = '#ff3d7f';
  ctx.fillText('Sonte?', 80 + kd, 110);

  // Date pill
  let y = 1080;
  const dateText = `${longDate(e.date, lang)}${e.time ? ` · ${e.time}` : ''}`.toUpperCase();
  ctx.font = '800 36px Inter, sans-serif';
  const pw = ctx.measureText(dateText).width + 60;
  ctx.fillStyle = '#ff3d7f';
  roundRect(ctx, 80, y, pw, 76, 38);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(dateText, 110, y + 20);
  y += 120;

  // Title
  ctx.font = `800 104px ${display}`;
  ctx.fillStyle = '#ffffff';
  for (const line of wrapLines(ctx, e.name, W - 160, 3)) {
    ctx.fillText(line, 80, y);
    y += 118;
  }

  if (e.artists) {
    ctx.font = '700 46px Inter, sans-serif';
    ctx.fillStyle = `rgb(${accent})`;
    for (const line of wrapLines(ctx, `🎤 ${e.artists}`, W - 160, 2)) {
      ctx.fillText(line, 80, y + 6);
      y += 60;
    }
  }

  ctx.font = '600 44px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.fillText(`📍 ${e.venue}, ${e.city}`, 80, y + 24);
  y += 84;
  if (e.price) {
    ctx.fillText(`🎟  ${e.price}`, 80, y + 24);
  }

  // Footer CTA
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  roundRect(ctx, 80, H - 230, W - 160, 120, 60);
  ctx.fill();
  ctx.font = '700 42px Inter, sans-serif';
  ctx.fillStyle = '#ffffff';
  const cta = `${lang === 'sq' ? 'Rezervo te' : 'Reserve at'} ${siteHost}`;
  const cw = ctx.measureText(cta).width;
  ctx.fillText(cta, (W - cw) / 2, H - 192);

  return await new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
}
