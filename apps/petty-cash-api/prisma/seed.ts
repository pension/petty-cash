import 'dotenv/config';
import { PrismaService } from '../src/prisma/prisma.service';
import { seedFund } from './seeds/fund';

async function seed() {
  const db = new PrismaService();
  try {
    await seedFund(db);
    console.log('Initial Petty Cash fund seeded (or matching existing fund retained).');
  } finally {
    await db.$disconnect();
  }
}

void seed().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Petty Cash seed failed.');
  process.exitCode = 1;
});
