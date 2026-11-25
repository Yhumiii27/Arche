'use client';
// Top bar of the compact layout (≤ 1024 px, Norma 2.0's MobileTopBar): "Menu" button opening the sidebar as a drawer · the
// tool's name · the language / display pair, last. A Client Component so that the logo glyph is not passed from the server.
import type { ReactNode } from 'react';
import { MobileTopBar } from '@norma/charte/ds/AppShell';
import { ToolLogo } from '@norma/charte/ds/ToolLogo';

export function ArcheTopBar({ prefs }: { prefs: ReactNode }) {
  return <MobileTopBar name="Arche" logo={<ToolLogo code="arche" size={20} />} prefs={prefs} />;
}
