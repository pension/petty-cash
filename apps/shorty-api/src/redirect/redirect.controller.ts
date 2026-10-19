import {
  Controller,
  Get,
  GoneException,
  HttpStatus,
  Param,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { UAParser } from 'ua-parser-js';
import { getClientIp } from '../common/client-ip.util';
import { lookupGeo } from '../common/geoip.util';
import { PrismaService } from '../prisma/prisma.service';

const linkNotFoundPage = readFileSync(
  join(__dirname, 'link-not-found.html'),
  'utf8',
);

// Public — deliberately no @UseGuards(IdentityGuard). Anyone clicking a short
// link or scanning a QR code hits this without being logged into petty-cash-ui.
@Controller()
export class RedirectController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':code')
  async click(
    @Param('code') code: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.resolve(code, 'click', req, res);
  }

  @Get('r/:code')
  async scan(
    @Param('code') code: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.resolve(code, 'scan', req, res);
  }

  private async resolve(
    code: string,
    type: 'click' | 'scan',
    req: Request,
    res: Response,
  ) {
    const link = await this.prisma.shortLink.findUnique({
      where: { shortCode: code },
    });
    if (!link) {
      res.status(HttpStatus.NOT_FOUND).type('html').send(linkNotFoundPage);
      return;
    }

    if (link.expiresAt && link.expiresAt < new Date()) {
      throw new GoneException('This link has expired.');
    }
    if (link.status === 'archived') {
      throw new GoneException('This link has been archived.');
    }

    const uaString = req.get('user-agent') ?? '';
    const parser = new UAParser(uaString);
    const device = parser.getDevice();
    const deviceType =
      device.type === 'mobile'
        ? 'Mobile'
        : device.type === 'tablet'
          ? 'Tablet'
          : 'Desktop';
    const browser = parser.getBrowser().name ?? 'Other';
    const os = parser.getOS().name ?? 'Other';
    const referrer = req.get('referer') ?? null;
    const ipAddress = getClientIp(req);
    const geo = lookupGeo(ipAddress);

    // /r/:code is the QR-scan path — if this link has a linked QR code,
    // credit the scan to it too. /:code (plain click) never touches QRCode.
    const qrCode =
      type === 'scan'
        ? await this.prisma.qRCode.findFirst({ where: { linkId: link.id } })
        : null;

    await this.prisma.$transaction([
      this.prisma.engagementEvent.create({
        data: {
          type,
          linkId: link.id,
          qrCodeId: qrCode?.id,
          ipAddress,
          userAgent: uaString,
          referrer,
          deviceType,
          browser,
          os,
          countryCode: geo.countryCode,
          countryName: geo.countryName,
          cityName: geo.cityName,
        },
      }),
      this.prisma.shortLink.update({
        where: { id: link.id },
        data: { clicks: { increment: 1 } },
      }),
      ...(qrCode
        ? [
            this.prisma.qRCode.update({
              where: { id: qrCode.id },
              data: { scans: { increment: 1 } },
            }),
          ]
        : []),
    ]);

    res.redirect(HttpStatus.FOUND, link.longUrl);
  }
}
