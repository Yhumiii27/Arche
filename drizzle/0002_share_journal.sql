-- Custom SQL migration file, put your code below! --
-- Share view of the EPC2I data sharing convention (Matrix: infra/postgres/partage/70-arche.sql, proposed in
-- docs/DEMANDES-MATRIX.md M-4; journal contract D18, partage/95-matrix-journal-unifie.sql). A pub_ view is a contract: a column
-- is never removed nor renamed (a change goes to pub_journal_v2), new columns go at the end. Readers' grants: Matrix
-- (partage/90-droits.sql). `projet` carries the CAPEX code; `qui_matricule` stays null until Arche knows matricules (N-25).
CREATE OR REPLACE VIEW "arche"."pub_journal" WITH (security_barrier) AS
SELECT 'audit_entries:' || a.id::text AS ref_source,
       'audit'::text            AS nature,
       a.occurred_at            AS quand,
       a.actor_name             AS qui,
       a.actor_user_id::text    AS qui_ref,
       a.actor_role             AS qui_role,
       a.area                   AS action,
       a.object_ref             AS objet,
       a.change                 AS detail,
       c.code                   AS projet,
       NULL::text               AS qui_matricule
FROM "arche"."audit_entries" a
LEFT JOIN "arche"."capex" c ON c.id = a.capex_id
UNION ALL
SELECT 'activity_events:' || e.id::text, 'activite', e.occurred_at, e.actor_name, e.actor_user_id::text, NULL,
       'activity.' || e.kind, NULL, e.text, c.code, NULL::text
FROM "arche"."activity_events" e
LEFT JOIN "arche"."capex" c ON c.id = e.capex_id;
--> statement-breakpoint
COMMENT ON VIEW "arche"."pub_journal" IS 'Contrat D18 v1 : piste d''audit et fil d''activité d''Arche aux colonnes communes. Lecteur : matrix_app (matrix.journal_unifie).';
