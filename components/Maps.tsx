// Map components (Leaflet + dark CARTO tiles). This file is lazy-loaded, so
// visitors who never open a map don't download Leaflet at all.
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { AppEvent } from '../types';
import { CITY_COORDS, MAP_BOUNDS } from '../shared/constants.js';
import { useI18n } from '../lib/i18n';
import { relativeLabel } from '../lib/dates';
import { FALLBACK_IMAGE } from './EventCard';

// OpenStreetMap tiles: free, no API key. Made dark with a CSS filter on the tile
// layer only (see .kd-dark-tiles in index.css), so pins keep their colours.
// If traffic grows a lot, switch to a provider with a key (MapTiler, Stadia, Google).
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const ALBANIA_CENTER: [number, number] = [41.0, 19.95];

function esc(s: string) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function baseMap(el: HTMLElement, opts: L.MapOptions = {}) {
  const map = L.map(el, {
    zoomControl: false,
    attributionControl: true,
    maxBounds: L.latLngBounds([MAP_BOUNDS.minLat - 0.5, MAP_BOUNDS.minLng - 0.5], [MAP_BOUNDS.maxLat + 0.5, MAP_BOUNDS.maxLng + 0.5]),
    ...opts,
  });
  L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19, minZoom: 7, className: 'kd-dark-tiles' }).addTo(map);
  map.attributionControl.setPrefix(false);
  return map;
}

const pinIcon = (html: string, size = 52) =>
  L.divIcon({ className: 'kd-marker', html, iconSize: [size, size], iconAnchor: [size / 2, size], popupAnchor: [0, -size] });

const simplePin = () =>
  pinIcon(`<div class="kd-pin-simple"><span></span></div>`, 36);

// ---------------------------------------------------------------------------
// Events map (feed "Hartë" tab)
// ---------------------------------------------------------------------------
export const EventsMap: React.FC<{ events: AppEvent[]; onOpen: (e: AppEvent) => void }> = ({ events, onOpen }) => {
  const { lang } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const map = baseMap(ref.current);
    map.setView(ALBANIA_CENTER, 8);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    // One marker per venue location; it shows how many events are there.
    const groups = new Map<string, AppEvent[]>();
    for (const e of events) {
      if (typeof e.lat !== 'number' || typeof e.lng !== 'number') continue;
      const k = `${e.lat.toFixed(4)},${e.lng.toFixed(4)}`;
      groups.set(k, [...(groups.get(k) || []), e]);
    }

    const pts: L.LatLngExpression[] = [];
    for (const list of groups.values()) {
      const first = list[0];
      const premium = list.some((e) => e.isPromoted);
      const html = `<div class="kd-pin ${premium ? 'kd-pin-gold' : ''}"><img src="${esc(first.image || FALLBACK_IMAGE)}" alt="" />${
        list.length > 1 ? `<b>${list.length}</b>` : ''
      }</div>`;
      const marker = L.marker([first.lat!, first.lng!], { icon: pinIcon(html), riseOnHover: true });
      const popup = document.createElement('div');
      popup.className = 'kd-popup';
      for (const e of list.slice(0, 4)) {
        const btn = document.createElement('button');
        btn.innerHTML = `<img src="${esc(e.image || FALLBACK_IMAGE)}" alt="" /><span><strong>${esc(e.name)}</strong><small>${esc(e.venue)} · ${esc(
          relativeLabel(e.date, lang)
        )}${e.time ? ' · ' + esc(e.time) : ''}</small></span>`;
        btn.onclick = () => onOpen(e);
        popup.appendChild(btn);
      }
      marker.bindPopup(popup, { closeButton: false, className: 'kd-popup-wrap', maxWidth: 280 });
      marker.addTo(layer);
      pts.push([first.lat!, first.lng!]);
    }
    if (pts.length === 1) map.setView(pts[0], 15);
    else if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 15 });
  }, [events, lang]);

  return <div ref={ref} className="h-[65vh] min-h-[420px] w-full overflow-hidden rounded-[28px] ring-1 ring-white/10" />;
};

// ---------------------------------------------------------------------------
// Location picker (venue form + admin edit)
// ---------------------------------------------------------------------------
interface PickerProps {
  city: string;
  lat?: number;
  lng?: number;
  onChange: (lat?: number, lng?: number) => void;
}

export const LocationPicker: React.FC<PickerProps> = ({ city, lat, lng, onChange }) => {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const place = (ll: L.LatLng) => {
    const map = mapRef.current!;
    if (!markerRef.current) {
      markerRef.current = L.marker(ll, { icon: simplePin(), draggable: true }).addTo(map);
      markerRef.current.on('dragend', () => {
        const p = markerRef.current!.getLatLng();
        onChangeRef.current(p.lat, p.lng);
      });
    } else markerRef.current.setLatLng(ll);
    onChangeRef.current(ll.lat, ll.lng);
  };

  useEffect(() => {
    if (!ref.current) return;
    const start = (typeof lat === 'number' && typeof lng === 'number' ? [lat, lng] : CITY_COORDS[city as keyof typeof CITY_COORDS] || ALBANIA_CENTER) as [number, number];
    const map = baseMap(ref.current);
    map.setView(start, typeof lat === 'number' ? 17 : 14);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    mapRef.current = map;
    if (typeof lat === 'number' && typeof lng === 'number') {
      markerRef.current = L.marker([lat, lng], { icon: simplePin(), draggable: true }).addTo(map);
      markerRef.current.on('dragend', () => {
        const p = markerRef.current!.getLatLng();
        onChangeRef.current(p.lat, p.lng);
      });
    }
    map.on('click', (e: L.LeafletMouseEvent) => place(e.latlng));
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // When the city changes and no pin is set yet, move the map there.
  useEffect(() => {
    if (markerRef.current || !mapRef.current) return;
    const c = CITY_COORDS[city as keyof typeof CITY_COORDS];
    if (c) mapRef.current.setView(c as [number, number], 14);
  }, [city]);

  const useMine = () => {
    if (!navigator.geolocation) return setGeoError(true);
    setLocating(true);
    setGeoError(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const ll = L.latLng(pos.coords.latitude, pos.coords.longitude);
        mapRef.current?.setView(ll, 18);
        place(ll);
      },
      () => {
        setLocating(false);
        setGeoError(true);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const clear = () => {
    markerRef.current?.remove();
    markerRef.current = null;
    onChange(undefined, undefined);
  };

  const hasPin = typeof lat === 'number' && typeof lng === 'number';

  return (
    <div>
      <div ref={ref} className="h-64 w-full overflow-hidden rounded-2xl ring-1 ring-white/10 md:h-72" />
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <button type="button" onClick={useMine} className="chip">
          📍 {locating ? t('map.locating') : t('map.useMine')}
        </button>
        {hasPin ? (
          <>
            <span className="font-semibold text-night-live">{t('map.set')}</span>
            <button type="button" onClick={clear} className="text-night-muted underline-offset-2 hover:text-white hover:underline">
              {t('map.clear')}
            </button>
          </>
        ) : (
          <span className="text-night-muted">{t('map.pickHint')}</span>
        )}
      </div>
      {geoError && <p className="mt-2 text-sm text-amber-300">{t('map.geoError')}</p>}
    </div>
  );
};
