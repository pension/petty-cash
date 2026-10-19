import { PrismaClient } from '@prisma/client';
import { SHORT_DOMAIN } from '../env';

const prisma = new PrismaClient();

async function main() {
  const shortCode = 'demo';
  const existing = await prisma.shortLink.findUnique({ where: { shortCode } });
  if (existing) {
    console.log(`Seed link "${shortCode}" already exists, skipping.`);
    return;
  }

  await prisma.shortLink.create({
    data: {
      title: 'Demo Link',
      longUrl: 'https://example.com',
      shortCode,
      shortUrl: `${SHORT_DOMAIN}/${shortCode}`,
      tags: ['demo'],
      history: {
        create: { label: 'Link Created', description: 'Seeded for local development', by: 'Seed Script' },
      },
      destinationHistory: {
        create: { destinationUrl: 'https://example.com', changedBy: 'Seed Script', isCurrent: true },
      },
      qrCode: {
        create: { title: 'Demo Link', longUrl: 'https://example.com' },
      },
    },
  });
  console.log(`Seeded short link: ${shortCode} -> https://example.com`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
