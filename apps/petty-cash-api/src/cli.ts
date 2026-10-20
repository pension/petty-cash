import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { FundBootstrapService } from './fund/fund-bootstrap.service';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { MaintenanceService } from './maintenance/maintenance.service';
async function main() {
  const app = await NestFactory.createApplicationContext(MaintenanceModule, {
    logger: false,
    abortOnError: false,
  });
  try {
    if (process.argv[2] === 'bootstrap') {
      await app.get(FundBootstrapService).initialize();
      console.log('Fund initialized (or matching existing fund retained).');
    } else if (process.argv[2] === 'maintenance') {
      await app.get(MaintenanceService).run();
      console.log('Maintenance completed.');
    } else throw new Error('Use bootstrap or maintenance.');
  } finally {
    await app.close();
  }
}
void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Petty Cash command failed');
  process.exitCode = 1;
});
