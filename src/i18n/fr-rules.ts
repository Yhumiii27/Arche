// Parameterised French renderings of the English sentences Arche builds with values (a count, a name, a code). The first
// rule that matches applies. Keep each rule anchored (^…$) and its captures to values.
export const FR_RULES: [RegExp, string][] = [
  [/^(\d+) CAPEX$/, '$1 CAPEX'],
  [/^(\d+) visible CAPEX$/, '$1 CAPEX visibles'],
  [/^Submit to gate (\S+)$/, 'Soumettre au jalon $1'],
  [/^Every blocking criterion of (\S+) is met or not evaluated yet: the gate can be submitted\.$/, 'Tous les critères bloquants du $1 sont atteints ou pas encore évalués : le jalon peut être soumis.'],
  [/^(\d+) sites$/, '$1 sites'],
  [/^Code given when saved: (\S+)$/, 'Code attribué à l’enregistrement : $1'],
  [/^Without location: (.+)$/, 'Sans localisation : $1'],
  [/^(\d+) without location$/, '$1 sans localisation'],
  [/^(\d+) in phases 1–2$/, '$1 en phases 1–2'],
  [/^Planned for delivery (\d+)$/, 'Prévu pour la livraison $1'],
  [/^delivery (\d+)$/, 'livraison $1'],
  [/^Next gate: (\S+)$/, 'Prochain jalon : $1'],
  [/^(\d+) lots?$/, '$1 lot(s)'],
  [/^(\d+) decisions?$/, '$1 décision(s)'],
  [/^(\d+) entries$/, '$1 entrée(s)'],
  [/^Record the (G1|G2|K3|G3) decision$/, 'Enregistrer la décision du $1'],
  [/^Edit version (\d+)$/, 'Modifier la version $1'],
  [/^(G1|G2|K3|G3) target delay \(working days\)$/, 'Délai cible du $1 (jours ouvrés)'],
];
