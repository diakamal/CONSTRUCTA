'use client';
// Leaflet touches `window`, so this file is only ever loaded in the browser (see site-map.tsx).
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import { Circle, CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { SiteMapProps } from './site-map';

const AMBER = '#f59e0b';

/** Keeps the view on the site when the center or radius is changed from outside the map. */
function FollowSite({ lat, lng, radius, showSite }: { lat: number; lng: number; radius: number; showSite: boolean }) {
  const map = useMap();
  const first = useRef(true);
  const hadSite = useRef(showSite);
  useEffect(() => {
    // No point yet: show the surrounding area (~2 km) so the manager can find the site.
    const bounds = circleBounds(lat, lng, showSite ? radius : 2000);
    const justPlaced = showSite && !hadSite.current; // first click on a new project → zoom in to the circle
    hadSite.current = showSite;
    if (first.current) {
      map.fitBounds(bounds, { padding: [24, 24] });
      first.current = false;
    } else if (justPlaced || !map.getBounds().contains(bounds)) {
      map.flyToBounds(bounds, { padding: [24, 24], duration: 0.4 });
    }
  }, [map, lat, lng, radius, showSite]);
  return null;
}

/** Bounding box of a circle of `radius` meters around (lat, lng). */
function circleBounds(lat: number, lng: number, radius: number): [[number, number], [number, number]] {
  const dLat = radius / 111_320;
  const dLng = radius / (111_320 * Math.cos((lat * Math.PI) / 180));
  return [[lat - dLat, lng - dLng], [lat + dLat, lng + dLng]];
}

function ClickToPlace({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function SiteMapInner({ lat, lng, radius, onPick, height = 320, readOnly = false, showSite = true }: SiteMapProps) {
  return (
    // Leaflet's controls assume LTR; the app is RTL. `isolate` keeps Leaflet's z-indexes inside the map.
    <div dir="ltr" className="isolate overflow-hidden rounded-lg border border-stone-200" style={{ height }}>
      <MapContainer
        center={[lat, lng]}
        zoom={17}
        style={{ height: '100%', width: '100%' }}
        dragging={!readOnly}
        scrollWheelZoom={!readOnly}
        doubleClickZoom={!readOnly}
        touchZoom={!readOnly}
        zoomControl={!readOnly}
        keyboard={!readOnly}
        attributionControl
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          // Opens in a new tab so an unsaved project form isn't lost.
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'
          maxZoom={19}
        />
        {showSite && (
          <>
            <Circle center={[lat, lng]} radius={radius} pathOptions={{ color: AMBER, weight: 2, fillOpacity: 0.15 }} />
            <CircleMarker center={[lat, lng]} radius={6} pathOptions={{ color: '#0f172a', weight: 2, fillColor: AMBER, fillOpacity: 1 }} />
          </>
        )}
        <FollowSite lat={lat} lng={lng} radius={radius} showSite={showSite} />
        {!readOnly && onPick && <ClickToPlace onPick={onPick} />}
      </MapContainer>
    </div>
  );
}
