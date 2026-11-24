// Dark / light display (Norma 1.0): the cookie epc2i-theme gives the theme the server puts on <html data-theme>, dark by
// default; the page header renders the toggle right after the FR / EN language toggle.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, THEME_COOKIE, themeCookie, themeOf } from '@norma/charte/ds/theme';

describe('display theme', () => {
  it('reads the cookie value, dark by default', () => {
    expect(THEME_COOKIE).toBe('epc2i-theme');
    expect(DEFAULT_THEME).toBe('dark');
    expect(themeOf('light')).toBe('light');
    expect(themeOf('dark')).toBe('dark');
    expect(themeOf(undefined)).toBe('dark');
    expect(themeOf(null)).toBe('dark');
    expect(themeOf('LIGHT')).toBe('dark');
    expect(themeOf('blue')).toBe('dark');
  });

  it('writes a one-year cookie for the whole site', () => {
    expect(themeCookie('light')).toBe('epc2i-theme=light; path=/; max-age=31536000; samesite=lax');
    expect(themeCookie('dark')).toMatch(/^epc2i-theme=dark; path=\/; max-age=31536000/);
  });

  it('the page header renders the theme toggle right after the language toggle', () => {
    const src = fs.readFileSync(path.join(__dirname, 'page-header.tsx'), 'utf8');
    expect(src).toMatch(/<LangToggle [^>]*\/>\s*<ThemeToggle theme=\{theme\} \/>/);
  });

  it('the root layout puts the theme read from the cookie on <html>', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/app/layout.tsx'), 'utf8');
    expect(src).toMatch(/<html [^>]*data-theme=\{theme\}/);
    expect(src).toContain("import '@norma/charte/nocturne.css'");
  });
});
