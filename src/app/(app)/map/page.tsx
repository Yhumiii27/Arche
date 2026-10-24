// CAPEX map (Keystone's projects map adapted to the CAPEX, owner's request of 22 Oct 2026): the CAPEX of the viewer's scope at
// their sites, on the zone chosen for the portfolio views (zone selector), framed World · zone · CAPEX, markers by phase,
// tooltip and "Sites" list leading to each CAPEX. Read-only; main action "New CAPEX" as on the register.
import { notFound } from 'next/navigation';
import { KpiGrid, KpiTile } from '@/components/app/Kpi';
import { ZoneSeg } from '@/components/app/ZoneSeg';
import { PageHeader } from '@/components/app/shell/page-header';
import type { CapexMapPoint } from '@/components/charts/capex-map';
import { canSee, screenHref } from '@/config/screens';
import { countryCentre } from '@/domain/country-centres';
import { capexMapKpis, capexMarkerStyle, uniq } from '@/domain/capex-map';
import { PHASE_SHORT, STATUS_LABEL, labelOf } from '@/domain/capex-labels';
import { OpenGuidedLink } from '@/features/capex/open-link';
import { MapPanels, type SiteGroup } from '@/features/map/map-panels';
import s from '@/features/map/map.module.css';
import { dataText } from '@/i18n/data-text';
import { fmtKeur } from '@/lib/format';
import { locatedSitesOf } from '@/server/dal/capex';
import { portfolioOf } from '@/server/dal/portfolio';
import { getI18n, getViewer, getZone } from '@/server/session';

export default async function CapexMapPage() {
  const [{ t, lang }, viewer, zone] = await Promise.all([getI18n(), getViewer(), getZone()]);
  if (!canSee(viewer.role, 'map')) notFound();
  const p = await portfolioOf(viewer, zone);
  const countryName = (iso2: string | null) => {
    if (!iso2) return '—';
    try {
      return new Intl.DisplayNames([lang], { type: 'region' }).of(iso2) ?? iso2;
    } catch {
      return iso2;
    }
  };
  // A CAPEX whose site has no coordinates (or without a site) is placed at the first located site of its subsidiary, else at the
  // centre of its site's (or subsidiary's) country, marked "Site to specify"; a country too small for the map is listed as not
  // located.
  const fallback = await locatedSitesOf([...new Set(p.rows.filter((c) => c.latitude == null || c.longitude == null).map((c) => c.subsidiaryCode))]);
  const placed = p.rows.map((c) => {
    if (c.latitude != null && c.longitude != null) return { c, lat: c.latitude, lng: c.longitude, city: c.siteCity ?? c.siteName, country: c.siteCountry, approx: false };
    const f = fallback.get(c.subsidiaryCode);
    if (f) return { c, lat: f.latitude, lng: f.longitude, city: f.city ?? f.name, country: f.countryIso2, approx: true };
    const country = c.siteCountry ?? c.subsidiaryCountry;
    const centre = countryCentre(country);
    return centre ? { c, lat: centre.latitude, lng: centre.longitude, city: c.siteCity ?? c.siteName ?? c.subsidiaryName, country, approx: true } : null;
  });
  const points: CapexMapPoint[] = placed.filter((x) => x !== null).map(({ c, lat, lng, city, country, approx }) => {
    const style = capexMarkerStyle(c.status, c.phase);
    return {
      code: c.code,
      name: `${c.code} · ${dataText(c.title, lang)}`,
      sub: [c.subsidiaryCode, c.leadName, approx ? t('Site to specify') : null].filter(Boolean).join(' · '),
      city: dataText(city, lang) ?? '—',
      country: countryName(country),
      lat,
      lng,
      style,
      status: { label: c.status === 'active' ? t(labelOf(PHASE_SHORT, c.phase)) : t(labelOf(STATUS_LABEL, c.status)), tone: c.status === 'active' ? 'accent' : 'outline' },
      health: null,
      href: screenHref('capex-overview', { code: c.code }),
    };
  });
  const keys = uniq(points.map((x) => `${x.city}|${x.country}`));
  const groups: SiteGroup[] = keys
    .map((k) => {
      const items = points.filter((x) => `${x.city}|${x.country}` === k);
      return { key: k, city: items[0].city, country: items[0].country, focusCode: items[0].code, items };
    })
    .sort((a, b) => b.items.length - a.items.length || a.city.localeCompare(b.city));
  const unlocated = p.rows.filter((_, i) => placed[i] === null);
  const kpis = capexMapKpis(points, unlocated.length);
  const budget = p.rows.reduce((a, c) => a + (c.validatedKeur ?? 0), 0);
  const zoneLabel = p.zoneName ? dataText(p.zoneName, lang) : null;
  return (
    <>
      <PageHeader screen="map" crumbs={['Group portfolio']} primary={<OpenGuidedLink viewer={viewer} />} />
      <div className={s.body}>
        <ZoneSeg zone={p.zone} options={p.zones.map((z) => ({ code: z.code, label: z.code ? dataText(z.name!, lang) : t('All zones'), count: z.count }))} />
        <KpiGrid>
          {kpis.map((k) => (
            <KpiTile key={k.label} label={t(k.label)} value={k.value} sub={k.label === 'Countries' ? k.sub : t(k.sub)} />
          ))}
          <KpiTile label={t('Validated budget')} value={fmtKeur(budget, lang)} sub={zoneLabel ?? t('All zones')} />
        </KpiGrid>
        <MapPanels
          points={points}
          zone={p.zoneBounds && zoneLabel ? { label: zoneLabel, bounds: p.zoneBounds } : null}
          groups={groups}
          sitesLabel={t('Sites')}
          emptyText={t('No CAPEX located in this zone')}
          unlocated={unlocated.map((c) => ({ code: c.code, name: dataText(c.title, lang), href: screenHref('capex-overview', { code: c.code }) }))}
          unlocatedTitle={t('Not on the map')}
          unlocatedHint={t('No located site in its subsidiary: give the site coordinates in Administration › Subsidiaries, sites, zones, then choose the site in the identity sheet.')}
          labels={{
            world: t('World'), europe: t('Europe'), fit: t('CAPEX'), ontrack: t('Phases 3–4'), risk: t('On hold'), pipeline: t('Phases 1–2'), closed: t('Draft or closed'),
            open: t('Open the CAPEX'), loading: t('Loading the map…'), failed: t('The map could not be loaded'), close: t('Close'), map: t('CAPEX map'), legend: t('Legend'), views: t('Framing'),
          }}
        />
      </div>
    </>
  );
}
