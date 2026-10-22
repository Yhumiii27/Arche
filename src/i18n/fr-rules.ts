// Parameterised French renderings of the English sentences Arche builds with values (a count, a name, a code). The first
// rule that matches applies. Keep each rule anchored (^…$) and its captures to values.
export const FR_RULES: [RegExp, string][] = [
  [/^(\d+) CAPEX$/, '$1 CAPEX'],
  [/^(\d+) visible CAPEX$/, '$1 CAPEX visibles'],
  [/^Planned for delivery (\d+)$/, 'Prévu pour la livraison $1'],
];
