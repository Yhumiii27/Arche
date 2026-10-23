-- Custom SQL migration file, put your code below! --
-- pub_rex_v2: the common REX contract of Matrix (request "Matrix → Arche — Aligner arche.pub_rex sur le contrat commun du REX
-- (D22)", 23 Oct 2026): the same columns, in the same order and of the same types as keystone.pub_rex, so that Matrix joins
-- both registers by UNION ALL; the column proper to Arche (phase) at the end. pub_rex (v1) stays as it is: a pub_ view is a
-- contract, never changed in place. Only the published lessons appear.
CREATE OR REPLACE VIEW "arche"."pub_rex_v2" WITH (security_barrier) AS
SELECT 'rex_entries:' || r.id::text                      AS ref_source,
       'arche'::text                                     AS outil,
       NULL::text                                        AS projet_code,
       c.code                                            AS capex_code,
       'REX-' || lpad(r.number::text, 2, '0')            AS numero,
       r.category                                        AS categorie,
       r.title                                           AS titre,
       r.text                                            AS constat,
       NULL::text                                        AS impact,
       r.recommendation                                  AS recommandation,
       NULL::text                                        AS portee,
       'publie'::text                                    AS statut,
       r.author_name                                     AS auteur,
       r.published_at                                    AS cree_le,
       r.updated_at                                      AS maj_le,
       r.phase                                           AS phase
FROM "arche"."rex_entries" r
JOIN "arche"."capex" c ON c.id = r.capex_id
WHERE r.published_at IS NOT NULL;
--> statement-breakpoint
COMMENT ON VIEW "arche"."pub_rex_v2" IS 'Contrat commun du REX de Matrix (D22) : retours d''expérience publiés des CAPEX, mêmes colonnes que keystone.pub_rex, phase en fin de vue. Lecteur : matrix_app.';
--> statement-breakpoint
COMMENT ON VIEW "arche"."pub_rex" IS 'Contrat v1 (remplacé par pub_rex_v2, contrat commun de Matrix) : retours d''expérience publiés des CAPEX. Lecteur : matrix_app.';
