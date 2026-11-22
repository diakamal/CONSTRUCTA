'use client';
import dynamic from 'next/dynamic';

export interface SiteMapProps {
  lat: number;
  lng: number;
  /** Attendance radius in meters (drawn as a circle). */
  radius: number;
  /** Called when the manager clicks the map to set the site center. */
  onPick?: (lat: number, lng: number) => void;
  height?: number;
  readOnly?: boolean;
  /** false = no point chosen yet: show the map around lat/lng without the site marker. */
  showSite?: boolean;
}

// Leaflet needs `window`: load it only in the browser, with a same-size placeholder meanwhile.
const SiteMapInner = dynamic(() => import('./site-map-inner'), {
  ssr: false,
  loading: () => <div className="animate-pulse rounded-lg bg-stone-200" style={{ height: 320 }} />,
});

export function SiteMap(props: SiteMapProps) {
  return <SiteMapInner {...props} />;
}
