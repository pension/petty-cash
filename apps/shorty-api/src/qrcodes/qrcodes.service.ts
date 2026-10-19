import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQRCodeDto } from './dto/create-qrcode.dto';
import { UpdateQRCodeDto } from './dto/update-qrcode.dto';
import { QueryQRCodesDto } from './dto/query-qrcodes.dto';
import { RenderQRCodeDto } from './dto/render-qrcode.dto';

// Long-edge target for rasterized output — the frame box (220x270) isn't
// square like the bare QR, so width/height are derived from its actual
// aspect ratio rather than a hardcoded square size.
const RASTER_LONG_EDGE = 1024;

function dataUriToBuffer(dataUri: string): Buffer | null {
  const match = /^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/.exec(dataUri);
  if (!match) return null;
  try {
    return Buffer.from(match[1], 'base64');
  } catch {
    return null;
  }
}

@Injectable()
export class QrCodesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryQRCodesDto) {
    const { search, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.QRCodeWhereInput = search
      ? {
          OR: [
            { title: { contains: search } },
            { longUrl: { contains: search } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.qRCode.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.qRCode.count({ where }),
    ]);

    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const qr = await this.prisma.qRCode.findUnique({
      where: { id },
      include: { template: true, frame: true, link: true },
    });
    if (!qr) throw new NotFoundException(`QR code with ID ${id} not found`);
    return qr;
  }

  create(dto: CreateQRCodeDto) {
    return this.prisma.qRCode.create({ data: dto });
  }

  async update(id: string, dto: UpdateQRCodeDto) {
    await this.findOne(id);
    return this.prisma.qRCode.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.qRCode.delete({ where: { id } });
  }

  // Stateless — renders whatever design is currently on screen, not what's
  // persisted (the save handler drops overlay/frame fields; see AGENTS.md).
  async render(dto: RenderQRCodeDto, format: 'svg' | 'png') {
    if (!dto.frame) return this.renderBare(dto, format);
    return this.renderFramed(dto, dto.frame, format);
  }

  private async renderBare(dto: RenderQRCodeDto, format: 'svg' | 'png') {
    const svg = buildQrSvg(dto);
    if (format === 'svg') {
      // buildQrSvg's root <svg> is viewBox-only (no fixed size) so it scales
      // cleanly wherever it's embedded client-side. A downloaded file needs
      // an intrinsic size or most standalone viewers default to ~300x150.
      const sized = svg.replace('<svg ', '<svg width="1024" height="1024" ');
      return {
        buffer: Buffer.from(sized),
        contentType: 'image/svg+xml',
        extension: 'svg',
      };
    }
    // .resize() before .png() makes sharp re-rasterize the SVG vector at the
    // target size (not upscale a tiny default raster, which would be blurry)
    // — the SVG's viewBox is in QR-module units (~25-45), so a bare
    // `sharp(svg).png()` would default to a near-unusable ~30px image.
    const buffer = await sharp(Buffer.from(svg))
      .resize(1024, 1024)
      .png()
      .toBuffer();
    return { buffer, contentType: 'image/png', extension: 'png' };
  }

  private async renderFramed(
    dto: RenderQRCodeDto,
    frame: NonNullable<RenderQRCodeDto['frame']>,
    format: 'svg' | 'png',
  ) {
    // Frame box (220x270) isn't square — derive raster dimensions from its
    // actual aspect ratio instead of reusing the bare-QR square constants.
    const rasterHeight = RASTER_LONG_EDGE;
    const rasterWidth = Math.round(
      RASTER_LONG_EDGE * (FRAME_BOX_WIDTH / FRAME_BOX_HEIGHT),
    );

    if (format === 'svg') {
      const svg = buildFramedQrSvg({ ...dto, ...frame });
      const sized = svg.replace(
        '<svg ',
        `<svg width="${rasterWidth}" height="${rasterHeight}" `,
      );
      return {
        buffer: Buffer.from(sized),
        contentType: 'image/svg+xml',
        extension: 'svg',
      };
    }

    // sharp/librsvg can't rasterize an embedded data-URI <image> element
    // (confirmed directly — even a minimal isolated SVG with one silently
    // fails under sharp, unlike a real browser). For 'custom-upload' with
    // an image, composite it as a separate raster layer via sharp's own
    // .composite() instead of relying on SVG-embedded image rendering.
    if (frame.frameType === 'custom-upload' && frame.customImageUrl) {
      const imageBuffer = dataUriToBuffer(frame.customImageUrl);
      if (imageBuffer) {
        try {
          const [background, chrome] = await Promise.all([
            sharp(imageBuffer)
              .resize(rasterWidth, rasterHeight)
              .png()
              .toBuffer(),
            sharp(
              Buffer.from(
                buildFramedQrSvg({
                  ...dto,
                  ...frame,
                  transparentBackground: true,
                }),
              ),
            )
              .resize(rasterWidth, rasterHeight)
              .png()
              .toBuffer(),
          ]);
          const buffer = await sharp(background)
            .composite([{ input: chrome, top: 0, left: 0 }])
            .png()
            .toBuffer();
          return { buffer, contentType: 'image/png', extension: 'png' };
        } catch {
          // Malformed/undecodable image — fall through to the plain
          // chrome-only render below rather than failing the request.
        }
      }
    }

    const svg = buildFramedQrSvg({ ...dto, ...frame });
    const buffer = await sharp(Buffer.from(svg))
      .resize(rasterWidth, rasterHeight)
      .png()
      .toBuffer();
    return { buffer, contentType: 'image/png', extension: 'png' };
  }
}
