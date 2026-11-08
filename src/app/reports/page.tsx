import React, { Suspense } from 'react';
import { ReportsView } from '@/features/reports/ReportsView';

export default function ReportsPage() {
  return (
    <Suspense fallback={<div style={{ padding: '24px', color: '#64748b' }}>Loading report data...</div>}>
      <ReportsView />
    </Suspense>
  );
}
