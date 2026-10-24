// Phosphor icons of the screens (kept out of ./screens.ts so that server code and scripts load the registry without React).
import type { Icon } from '@phosphor-icons/react';
import {
  Books, ChartLineUp, CheckSquareOffset, ClipboardText, Factory, FileText, Gauge, Gavel, GearSix, House, Key, ListChecks, MapTrifold,
  Notebook, Path, PlugsConnected, Scales, ShieldCheck, Stack, Strategy, PlusCircle, Target, TrendUp, UsersThree, Warning, Buildings, Wrench, Wallet,
} from '@phosphor-icons/react/dist/ssr';
import type { ScreenId } from './screens';

export const SCREEN_ICONS: Record<ScreenId, Icon> = {
  home: House,
  approvals: CheckSquareOffset,
  'capex-list': Stack,
  map: MapTrifold,
  portfolio: ChartLineUp,
  copil: Gavel,
  kpi: Target,
  'subsidiary-portfolio': Buildings,
  'capex-open': PlusCircle,
  rex: Books,
  'capex-overview': Factory,
  'capex-gates': Path,
  'capex-dossiers': FileText,
  'capex-budget': Wallet,
  'capex-execution': TrendUp,
  'capex-changes': Scales,
  'capex-machines': Wrench,
  'capex-pack': ClipboardText,
  'capex-permits': Key,
  'capex-safety': ShieldCheck,
  'capex-risks': Warning,
  'capex-governance': UsersThree,
  'capex-rampup': Gauge,
  'capex-journal': Notebook,
  'admin-org': Buildings,
  'admin-users': UsersThree,
  'admin-model': Strategy,
  'admin-delegation': ListChecks,
  'admin-connectors': PlugsConnected,
};

export const ADMIN_ICON = GearSix;
