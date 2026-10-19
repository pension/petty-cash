import { Module } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { IdentityModule } from '@pension/midgard';
import { ZodValidationPipe } from 'nestjs-zod';
import { PrismaModule } from './prisma/prisma.module';
import { LinksModule } from './links/links.module';
import { QrCodesModule } from './qrcodes/qrcodes.module';
import { TemplatesModule } from './templates/templates.module';
import { FramesModule } from './frames/frames.module';
import { AnalyticsModule } from './analytics/analytics.module';
// RedirectModule owns the top-level `GET /:code` catch-all — keep it last so
// literal routes from every other module resolve first and are never
// shadowed by the wildcard.
import { RedirectModule } from './redirect/redirect.module';

@Module({
  imports: [
    IdentityModule.forRoot({ petty-cash: ['read:user'] }),
    PrismaModule,
    LinksModule,
    QrCodesModule,
    TemplatesModule,
    FramesModule,
    AnalyticsModule,
    RedirectModule,
  ],
  controllers: [],
  providers: [{ provide: APP_PIPE, useClass: ZodValidationPipe }],
})
export class AppModule {}
