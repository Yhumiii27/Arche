// Group portfolio (docs/spec/06 §5; "Group portfolio" section, owner 24 Oct 2026): the portfolio dashboard of the viewer's
// scope on the zone chosen (src/features/portfolio/portfolio-view.tsx).
import { PortfolioView } from '@/features/portfolio/portfolio-view';

export default function PortfolioPage() {
  return <PortfolioView level="group" />;
}
