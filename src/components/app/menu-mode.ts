'use client';
// Header actions menu (owner's pilot feedback, 25 Oct 2026): when a page has more actions than fit in its header, they go in
// an "Actions" drop-down list. An action inside it (Folded, ActionButton, ActionLink) reads this context to render as a menu
// row instead of a button, and calls `close` once chosen. Outside the menu the context is null.
import { createContext, useContext } from 'react';

export const MenuModeCtx = createContext<{ close: () => void } | null>(null);

export const useMenuMode = () => useContext(MenuModeCtx);
