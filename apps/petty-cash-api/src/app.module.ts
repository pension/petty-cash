import { Module } from '@nestjs/common';
import { IdentityModule } from '@pension/midgard';
import { BUSINESS_MODULES } from './business.modules';
@Module({ imports: [IdentityModule.forRoot({ 'petty-cash': ['read:user'] }), ...BUSINESS_MODULES] })
export class AppModule {}
