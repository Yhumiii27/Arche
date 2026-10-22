-- Custom SQL migration file, put your code below! ---- Share view of the CAPEX (docs/CONTRATS.md §3; Matrix partage/70-arche.sql, proposed in docs/DEMANDES-MATRIX.md M-4). A pub_
-- view is a contract: a column is never removed nor renamed (a change goes to pub_capex_v2), new columns go at the end.
-- Drafts stay inside their subsidiary (N-5): not published. Readers' grants: Matrix (partage/90-droits.sql).
CREATE OR REPLACE VIEW "arche"."pub_capex" WITH (security_barrier) AS
SELECT c.code                          AS code,
       c.subsidiary_code               AS filiale_code,
       s.name                          AS filiale,
       z.name                          AS zone,
       si.name                         AS site,
       s.country_iso2                  AS pays_iso2,
       c.title                         AS intitule,
       c.investment_type               AS type_investissement,
       c.status                        AS statut,
       c.phase                         AS phase_code,
       c.typology                      AS typologie,
       sp.display_name                 AS sponsor_nom,
       sp.email                        AS sponsor_email,
       ld.display_name                 AS chef_projet_nom,
       ld.email                        AS chef_projet_email,
       (SELECT min(g.decided_at)::date FROM "arche"."gates" g
         WHERE g.capex_id = c.id AND g.code = 'G1' AND g.decision IN ('go', 'go_with_conditions')) AS g1_le,
       (SELECT min(g.decided_at)::date FROM "arche"."gates" g
         WHERE g.capex_id = c.id AND g.code = 'G2' AND g.decision IN ('go', 'go_with_conditions')) AS g2_le,
       (SELECT min(g.decided_at)::date FROM "arche"."gates" g
         WHERE g.capex_id = c.id AND g.code = 'G3' AND g.decision IN ('go', 'go_with_conditions')) AS g3_le,
       c.mes_started_on                AS debut_mes_le,
       c.updated_at                    AS maj_le
FROM "arche"."capex" c
JOIN "arche"."subsidiaries" s ON s.code = c.subsidiary_code
JOIN "arche"."zones" z ON z.code = s.zone_code
LEFT JOIN "arche"."sites" si ON si.id = c.site_id
LEFT JOIN "arche"."users" sp ON sp.id = c.sponsor_user_id
LEFT JOIN "arche"."users" ld ON ld.id = c.lead_user_id
WHERE c.status <> 'draft';
--> statement-breakpoint
COMMENT ON VIEW "arche"."pub_capex" IS 'Contrat v1 : CAPEX ouverts d''Arche (hors brouillons). Lecteurs : keystone_app, matrix_app.';
