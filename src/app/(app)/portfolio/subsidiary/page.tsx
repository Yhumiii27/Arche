// Subsidiary portfolio ("Subsidiary portfolio" section, owner 24 Oct 2026): the portfolio dashboard of the subsidiary chosen in
// the sidebar, within the viewer's scope (src/features/portfolio/portfolio-view.tsx).
import { PortfolioView } from '@/features/portfolio/portfolio-view';

export default function SubsidiaryPortfolioPage() {
  return <PortfolioView level="subsidiary" />;
}
