import type ApexCharts from 'apexcharts';

let apexChartsPromise: Promise<typeof ApexCharts> | null = null;

export async function loadApexCharts() {
  if (import.meta.server) {
    return null;
  }

  apexChartsPromise ??= import('apexcharts').then(
    (module) => module.default ?? module,
  );

  return apexChartsPromise;
}