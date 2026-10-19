import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { IdentityGuard, PermissionGuard } from '@pension/midgard';
import { QrCodesService } from './qrcodes.service';
import { CreateQRCodeDto } from './dto/create-qrcode.dto';
import { UpdateQRCodeDto } from './dto/update-qrcode.dto';
import { QueryQRCodesDto } from './dto/query-qrcodes.dto';
import { RenderQRCodeDto } from './dto/render-qrcode.dto';
import { QueryRenderQRCodeDto } from './dto/query-render-qrcode.dto';

@UseGuards(IdentityGuard, PermissionGuard)
@Controller('api/v1/shorturl/qrcodes')
export class QrCodesController {
  constructor(private readonly qrCodesService: QrCodesService) {}

  @Get()
  findAll(@Query() query: QueryQRCodesDto) {
    return this.qrCodesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.qrCodesService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateQRCodeDto) {
    return this.qrCodesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateQRCodeDto) {
    return this.qrCodesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.qrCodesService.remove(id);
  }

  // Stateless — renders whatever design params are sent, doesn't touch the
  // database. Lets the download button export exactly what's on screen,
  // including unsaved changes.
  @Post('render')
  async render(
    @Body() dto: RenderQRCodeDto,
    @Query() query: QueryRenderQRCodeDto,
    @Res() res: Response,
  ) {
    const { buffer, contentType, extension } = await this.qrCodesService.render(
      dto,
      query.format,
    );
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="qrcode.${extension}"`,
    });
    res.send(buffer);
  }
}
