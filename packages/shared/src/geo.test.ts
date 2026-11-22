import { describe, expect, it } from 'vitest';
import { distanceMeters, isInsideGeofence } from './geo';
import { resources } from './i18n';

const site = { lat: 32.0853, lng: 34.7818 }; // Tel Aviv

describe('geofence', () => {
  it('distance to self is zero', () => {
    expect(distanceMeters(site, site)).toBe(0);
  });
  it('~111m per 0.001 deg latitude', () => {
    const d = distanceMeters(site, { lat: site.lat + 0.001, lng: site.lng });
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(112);
  });
  it('inside / outside radius', () => {
    expect(isInsideGeofence({ lat: site.lat + 0.001, lng: site.lng }, site, 150)).toBe(true);
    expect(isInsideGeofence({ lat: site.lat + 0.002, lng: site.lng }, site, 150)).toBe(false);
  });
});

describe('locales', () => {
  it('every language has the same keys as Hebrew', () => {
    const keys = Object.keys(resources.he).sort();
    for (const [lang, dict] of Object.entries(resources)) {
      expect(Object.keys(dict).sort(), lang).toEqual(keys);
    }
  });
});
