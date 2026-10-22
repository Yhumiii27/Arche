-- Custom SQL migration file, put your code below! ---- Share view of the machine needs (docs/CONTRATS.md §3; Matrix partage/70-arche.sql, docs/DEMANDES-MATRIX.md M-4). A pub_
-- view is a contract: a column is never removed nor renamed (a change goes to pub_besoins_machines_v2), new columns go at
-- the end. Drafts are not published: Keystone sees a need once the project lead submits it.
CREATE OR REPLACE VIEW "arche"."pub_besoins_machines" WITH (security_barrier) AS
SELECT c.code || '/B' || lpad(n.number::text, 2, '0') AS besoin_ref,
       c.code                          AS capex_code,
       'B' || lpad(n.number::text, 2, '0') AS ligne,
       n.catalogue_code                AS catalogue_code,
       n.catalogue_version             AS catalogue_version,
       n.free_label                    AS libelle_libre,
       n.quantity                      AS quantite,
       n.options                       AS options,
       n.target_capacity               AS capacite_visee,
       n.capacity_unit                 AS unite_capacite,
       n.need_date                     AS date_besoin,
       si.name                         AS site,
       n.status                        AS statut,
       n.comment                       AS commentaire,
       n.submitted_at                  AS soumis_le,
       n.ordered_on                    AS commande_le,
       n.updated_at                    AS maj_le
FROM "arche"."machine_needs" n
JOIN "arche"."capex" c ON c.id = n.capex_id
LEFT JOIN "arche"."sites" si ON si.id = c.site_id
WHERE n.status <> 'draft';
--> statement-breakpoint
COMMENT ON VIEW "arche"."pub_besoins_machines" IS 'Contrat v1 : besoins machines soumis à EPC2i (hors brouillons). Lecteurs : keystone_app, matrix_app.';
