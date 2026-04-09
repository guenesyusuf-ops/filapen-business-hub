import { FinanceDashboard } from './dashboard-client';

export const metadata = {
  title: 'Finance Hub - Filapen',
  description: 'Finance overview, P&L, and channel performance dashboard',
};

export default function FinancePage() {
  return <FinanceDashboard />;
}
