import type { LocationKind, MLocation } from '@constructa/shared';

export const KIND_LABEL: Record<LocationKind, string> = { building: 'בניין', floor: 'קומה', unit: 'דירה', room: 'חדר' };
export const CHILD_KIND: Record<LocationKind, LocationKind | null> = { building: 'floor', floor: 'unit', unit: 'room', room: null };

/** Locations flattened in tree order with a breadcrumb label: "בניין A / קומה 1 / דירה 11". */
export function locationOptions(locs: MLocation[]) {
  const out: { id: string; label: string; depth: number; loc: MLocation }[] = [];
  const walk = (parent: string | null, depth: number, prefix: string) => {
    for (const l of locs.filter((x) => x.parent_id === parent).sort((a, b) => a.sort - b.sort)) {
      const label = prefix ? `${prefix} / ${l.name}` : l.name;
      out.push({ id: l.id, label, depth, loc: l });
      walk(l.id, depth + 1, label);
    }
  };
  walk(null, 0, '');
  return out;
}
