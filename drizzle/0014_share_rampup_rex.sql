-- Custom SQL migration file, put your code below! ---- Share views of delivery 6 (docs/CONTRATS.md §3; Matrix partage/70-arche.sql and 90-droits.sql). A pub_ view is a contract: a
-- column is never removed nor renamed (a change goes to a _v2 view), new columns go at the end.
-- pub_rampup: one row per machine of the installed base on a production line of a CAPEX whose commissioning has started; the
-- figures are those of the line (src/domain/rampup.ts, stored on production_lines by every write).
CREATE OR REPLACE VIEW "arche"."pub_rampup" WITH (security_barrier) AS
SELECT m.numero                        AS machine_numero,
       c.code                          AS capex_code,
       l.name                          AS ligne_production,
       c.mes_started_on                AS debut_mes_le,
       l.nominal_per_day               AS capacite_nominale,
       l.unit                          AS unite_capacite,
       l.avg_capacity_pct              AS capacite_atteinte_pct,
       l.avg_oee_pct                   AS trs_reception_pct,
       l.avg_scrap_pct                 AS rebuts_reception_pct,
       l.reached_on                    AS trente_jours_le,
       l.rampup_status                 AS statut,
       greatest(l.updated_at, coalesce(l.computed_at, l.updated_at)) AS maj_le
FROM "arche"."production_lines" l
JOIN "arche"."capex" c ON c.id = l.capex_id
CROSS JOIN LATERAL jsonb_array_elements_text(l.machine_numbers) AS m(numero)
WHERE c.mes_started_on IS NOT NULL;
--> statement-breakpoint
COMMENT ON VIEW "arche"."pub_rampup" IS 'Contrat v1 : montée en puissance par machine du parc (lignes de production d''un CAPEX en MES). Lecteurs : keystone_app, matrix_app.';
--> statement-breakpoint
-- pub_rex (D22): the published lessons learned of the CAPEX, joined by Matrix with keystone.pub_rex. Proposal of
-- docs/CONTRATS.md §3 (columns to confirm with Matrix and Keystone): entries kept within the team are not published.
CREATE OR REPLACE VIEW "arche"."pub_rex" WITH (security_barrier) AS
SELECT r.id::text                      AS ref_source,
       c.code                          AS capex_code,
       NULL::text                      AS projet_code,
       r.category                      AS categorie,
       r.title                         AS titre,
       r.text                          AS texte,
       r.phase                         AS phase,
       r.published_at                  AS publie_le,
       r.author_name                   AS auteur
FROM "arche"."rex_entries" r
JOIN "arche"."capex" c ON c.id = r.capex_id
WHERE r.published_at IS NOT NULL;
--> statement-breakpoint
COMMENT ON VIEW "arche"."pub_rex" IS 'Contrat v1 (proposition, D22) : retours d''expérience publiés des CAPEX. Lecteur : matrix_app.';
