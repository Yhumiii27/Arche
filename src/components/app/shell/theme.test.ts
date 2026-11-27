// Dark / light display (Norma 1.0) and the common shell (Norma 2.0, norma/charte/COQUE.md § 4): the cookie atrium-theme (Norma 3.0;
// the former name still read as a fallback) gives the theme the server puts on <html data-theme>, dark by default; the language / display pair (PrefsStack: FR | EN over
// dark | light) is the last element of every page header and of the top bar, nowhere else.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, LEGACY_THEME_COOKIE, THEME_COOKIE, themeCookie, themeFromCookies, themeOf } from '@norma/charte/ds/theme';

describe('display theme', () => {
  it('reads the cookie value, dark by default', () => {
    expect(THEME_COOKIE).toBe('atrium-theme');
    expect(DEFAULT_THEME).toBe('dark');
    expect(themeOf('light')).toBe('light');
    expect(themeOf('dark')).toBe('dark');
    expect(themeOf(undefined)).toBe('dark');
    expect(themeOf(null)).toBe('dark');
    expect(themeOf('LIGHT')).toBe('dark');
    expect(themeOf('blue')).toBe('dark');
  });

  it('writes a one-year cookie for the whole site, under the new name only', () => {
    expect(themeCookie('light')).toBe('atrium-theme=light; path=/; max-age=31536000; samesite=lax');
    expect(themeCookie('dark')).toMatch(/^atrium-theme=dark; path=\/; max-age=31536000/);
  });

  it('reads the new cookie first, the former name as a fallback', () => {
    const jar = (cookies: Record<string, string>) => (name: string) => cookies[name];
    expect(themeFromCookies(jar({ [THEME_COOKIE]: 'light' }))).toBe('light');
    expect(themeFromCookies(jar({ [LEGACY_THEME_COOKIE]: 'light' }))).toBe('light');
    expect(themeFromCookies(jar({ [THEME_COOKIE]: 'dark', [LEGACY_THEME_COOKIE]: 'light' }))).toBe('dark');
    expect(themeFromCookies(jar({}))).toBe('dark');
  });

  it('the server reads the theme through themeFromCookies', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/server/session.ts'), 'utf8');
    expect(src).toContain('themeFromCookies(');
  });

  it('the pair is the stacked PrefsStack, saved by setLang', () => {
    const src = fs.readFileSync(path.join(__dirname, 'prefs.tsx'), 'utf8');
    expect(src).toMatch(/<PrefsStack lang=\{lang\} theme=\{theme\} onSelect=\{setLang\} \/>/);
  });

  it('the page header and the top bar carry the pair, the sidebar does not', () => {
    const header = fs.readFileSync(path.join(__dirname, 'page-header.tsx'), 'utf8');
    expect(header).toContain("from '@norma/charte/ds/PageHeader'");
    expect(header).toMatch(/prefs=\{<ArchePrefs lang=\{lang\} theme=\{theme\} \/>\}/);
    const layout = fs.readFileSync(path.join(process.cwd(), 'src/app/(app)/layout.tsx'), 'utf8');
    expect(layout).toMatch(/<ArcheTopBar prefs=\{<ArchePrefs lang=\{lang\} theme=\{theme\} \/>\}/);
    const sidebar = fs.readFileSync(path.join(__dirname, 'sidebar.tsx'), 'utf8');
    expect(sidebar).not.toMatch(/PrefsStack|ArchePrefs|ThemeToggle|ThemeSwitch|LangSwitch|setLang/);
  });

  it('the root layout puts the theme read from the cookie on <html>', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/app/layout.tsx'), 'utf8');
    expect(src).toMatch(/<html [^>]*data-theme=\{theme\}/);
    expect(src).toContain("import '@norma/charte/nocturne.css'");
    expect(src.indexOf("import '@norma/charte/coque.css'")).toBeGreaterThan(src.indexOf("import '@norma/charte/touch.css'"));
    expect(src.indexOf("import '@norma/charte/touch.css'")).toBeGreaterThan(src.indexOf("import '@norma/charte/nocturne.css'"));
  });
});
