import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { IdentityGuard, PermissionGuard } from '@pension/midgard';
import { AnalyticsService } from './analytics.service';
import { QueryAnalyticsDto } from './dto/query-analytics.dto';

@UseGuards(IdentityGuard, PermissionGuard)
@Controller('api/v1/shorturl/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('global')
  getGlobal(@Query() query: QueryAnalyticsDto) {
    return this.analyticsService.getGlobal(query.range);
  }

  @Get('links/:id')
  getForLink(@Param('id') id: string, @Query() query: QueryAnalyticsDto) {
    return this.analyticsService.getForLink(id, query.range);
  }

  @Get('qrcodes/:id')
  getForQrCode(@Param('id') id: string, @Query() query: QueryAnalyticsDto) {
    return this.analyticsService.getForQrCode(id, query.range);
  }
}
