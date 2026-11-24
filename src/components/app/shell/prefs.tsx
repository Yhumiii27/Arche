// The language / display pair of Norma 2.0 (PrefsStack: FR | EN over dark | light, same size, left edges aligned), last
// element of every page header and of the top bar (norma/charte/COQUE.md § 4). The language is kept by setLang (cookie).
import { PrefsStack } from '@norma/charte/ds/HeaderTools';
import type { Theme } from '@norma/charte/ds/theme';
import type { Lang } from '@/i18n/translate';
import { setLang } from '@/server/actions/preferences';

export function ArchePrefs({ lang, theme }: { lang: Lang; theme: Theme }) {
  return <PrefsStack lang={lang} theme={theme} onSelect={setLang} />;
}
