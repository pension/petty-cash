import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { PORT } from 'env';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(PORT);

  // Without this, Ctrl+C/SIGINT has no explicit handler here at all, so
  // shutdown depends entirely on Node's default disposition — which some
  // process trees (e.g. `nest start --watch`'s child process) don't
  // reliably forward the signal through in the first place. Even when the
  // signal does arrive, @pension/midgard's IdentityService opens its own
  // ioredis connection directly (no OnModuleDestroy hook exists anywhere
  // on it — confirmed by reading the installed package), which keeps a
  // persistent TCP connection + reconnect timers alive and can stop the
  // process from exiting on its own after app.close(). Force it either way.
  const shutdown = async () => {
    await app.close().catch(() => undefined);
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}
void bootstrap();
