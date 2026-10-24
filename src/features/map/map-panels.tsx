'use client';
// CAPEX map — map card and "Sites" list (Keystone's projects map panels, origin commit 6645cb6): hovering a CAPEX row
// highlights its marker, a site header zooms the map on the site, a row opens the CAPEX. Strings arrive translated.
import { GlobeHemisphereEast, MapPin } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { Callout } from '@/components/app/Callout';
import { Eyebrow } from '@/components/app/Eyebrow';
import { CapexMap, type CapexMapHandle, type CapexMapLabels, type CapexMapPoint } from '@/components/charts/capex-map';
import { Tag } from '@/components/ds/Tag';
import type { GeoBounds } from '@/domain/capex-map';
import s from './map.module.css';

export interface SiteGroup {
  key: string;
  city: string;
  country: string;
  focusCode: string;
  items: CapexMapPoint[];
}

export function MapPanels({ points, labels, zone, groups, sitesLabel, emptyText, unlocated, unlocatedTitle, unlocatedHint }: {
  points: CapexMapPoint[];
  labels: CapexMapLabels;
  zone: { label: string; bounds: GeoBounds } | null;
  groups: SiteGroup[];
  sitesLabel: string;
  emptyText: string;
  /** "1 CAPEX without location: …", or null. */
  unlocated: { code: string; name: string; href: string }[];
  unlocatedTitle: string;
  unlocatedHint: string;
}) {
  const mapRef = useRef<CapexMapHandle>(null);
  const [hl, setHl] = useState<string | null>(null);
  return (
    <div className={s.panels}>
      <div className={`card elev-sm ${s.mapCard}`}>
        <CapexMap ref={mapRef} points={points} labels={labels} zone={zone} highlight={hl} />
      </div>
      <div className={s.list}>
        <Eyebrow flush>{`${sitesLabel} · ${groups.length}`}</Eyebrow>
        {!points.length && (
          <Callout icon={GlobeHemisphereEast} role="status">
            {emptyText}
          </Callout>
        )}
        {groups.map((g) => (
          <div key={g.key} className={`card elev-sm ${s.site}`}>
            <button type="button" className={s.siteHead} onClick={() => mapRef.current?.focus(g.focusCode)}>
              <MapPin className={s.pin} aria-hidden />
              <span className={s.city}>{g.city}</span>
              <span className={s.where}>{`${g.country} · ${g.items.length}`}</span>
            </button>
            {g.items.map((p) => (
              <Link key={p.code} href={p.href} className={s.item} onMouseEnter={() => setHl(p.code)} onMouseLeave={() => setHl(null)} onFocus={() => setHl(p.code)} onBlur={() => setHl(null)}>
                <span className={s.itemText}>
                  <span className={s.itemName}>{p.name}</span>
                  <span className={s.itemSub}>{p.sub}</span>
                </span>
                <span className={s.itemTags}>
                  <Tag tone={p.status.tone} size="sm">{p.status.label}</Tag>
                </span>
              </Link>
            ))}
          </div>
        ))}
        {unlocated.length > 0 && (
          <div className={`card elev-sm ${s.site}`}>
            <div className={s.siteHead}>
              <MapPin className={s.pin} aria-hidden />
              <span className={s.city}>{unlocatedTitle}</span>
              <span className={s.where}>{unlocated.length}</span>
            </div>
            {unlocated.map((u) => (
              <Link key={u.code} href={u.href} className={s.item}>
                <span className={s.itemText}>
                  <span className={s.itemName}>{`${u.code} · ${u.name}`}</span>
                </span>
              </Link>
            ))}
            <span className={s.hint}>{unlocatedHint}</span>
          </div>
        )}
      </div>
    </div>
  );
}
