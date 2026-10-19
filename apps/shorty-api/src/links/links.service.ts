import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { customAlphabet } from 'nanoid';
import { SHORT_DOMAIN } from 'env';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLinkDto } from './dto/create-link.dto';
import { UpdateLinkDto } from './dto/update-link.dto';
import { QueryLinksDto } from './dto/query-links.dto';

// nanoid's default alphabet includes digits, "-", and "_" (e.g. "-ujzrp") —
// letters only, both cases, for a generated shortCode.
const generateShortCode = customAlphabet(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  6,
);

@Injectable()
export class LinksService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryLinksDto) {
    const { search, status, tag, page, limit, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ShortLinkWhereInput = {};
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { shortCode: { contains: search } },
        { longUrl: { contains: search } },
      ];
    }
    if (status && status !== 'all') {
      if (status === 'expired') {
        where.expiresAt = { lt: new Date() };
      } else {
        where.status = status;
      }
    }
    if (tag) {
      where.tags = { array_contains: tag };
    }

    const [items, total] = await Promise.all([
      this.prisma.shortLink.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.shortLink.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const link = await this.prisma.shortLink.findUnique({
      where: { id },
      include: {
        history: { orderBy: { createdAt: 'desc' } },
        destinationHistory: { orderBy: { effectiveFrom: 'desc' } },
        _count: { select: { events: true } },
        qrCode: true,
      },
    });
    if (!link) throw new NotFoundException(`Link with ID ${id} not found`);
    return link;
  }

  async create(dto: CreateLinkDto, actor: string) {
    const shortCode = dto.customBackHalf
      ? dto.customBackHalf.trim()
      : generateShortCode();

    const existing = await this.prisma.shortLink.findUnique({
      where: { shortCode },
    });
    if (existing) {
      throw new ConflictException(
        `Short code "${shortCode}" is already in use.`,
      );
    }

    const shortUrl = `${SHORT_DOMAIN}/${shortCode}`;

    // A stale/deleted templateId just falls through to QRCode's own column
    // defaults below rather than failing link creation over it.
    const template = dto.templateId
      ? await this.prisma.qRTemplate.findUnique({
          where: { id: dto.templateId },
        })
      : null;

    return this.prisma.shortLink.create({
      data: {
        title: dto.title,
        longUrl: dto.longUrl,
        shortCode,
        shortUrl,
        tags: dto.tags ?? [],
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        history: {
          create: {
            label: 'Link Created',
            description: `Created short link ${shortUrl} targeting ${dto.longUrl}`,
            by: actor,
          },
        },
        destinationHistory: {
          create: {
            destinationUrl: dto.longUrl,
            changedBy: actor,
            isCurrent: true,
          },
        },
        // Every link gets exactly one auto-generated QRCode — see AGENTS.md
        // for why standalone QR creation was removed. Fields left undefined
        // (no template chosen) fall back to QRCode's own Prisma @default.
        qrCode: {
          create: {
            title: dto.title,
            longUrl: dto.longUrl,
            templateId: template?.id,
            // Frame is independent of template — chosen as its own step,
            // not derived from the template's fields.
            frameId: dto.frameId ?? undefined,
            color: template?.fgColor,
            bgColor: template?.bgColor,
            style: template?.style,
            corner: template?.corner,
            overlayType: template?.overlayType,
            overlayText: template?.overlayText,
            logo: template?.logo,
          },
        },
      },
      include: { qrCode: true },
    });
  }

  async update(id: string, dto: UpdateLinkDto, actor: string) {
    const current = await this.findOne(id);

    const changes: string[] = [];
    if (dto.longUrl && dto.longUrl !== current.longUrl) {
      changes.push(`Destination URL updated to "${dto.longUrl}"`);
    }
    if (dto.title && dto.title !== current.title) {
      changes.push(`Title renamed to "${dto.title}"`);
    }
    if (dto.status && dto.status !== current.status) {
      changes.push(`Status changed to ${dto.status}`);
    }
    if (dto.expiresAt !== undefined) {
      const nextExpiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
      const currentExpiresAt = current.expiresAt?.toISOString() ?? null;
      if ((nextExpiresAt?.toISOString() ?? null) !== currentExpiresAt) {
        changes.push(
          dto.expiresAt
            ? `Expiration set to ${dto.expiresAt}`
            : 'Expiration removed',
        );
      }
    }
    if (dto.tags && JSON.stringify(dto.tags) !== JSON.stringify(current.tags)) {
      changes.push(`Tags updated to [${dto.tags.join(', ')}]`);
    }

    return this.prisma.shortLink.update({
      where: { id },
      data: {
        title: dto.title,
        longUrl: dto.longUrl,
        tags: dto.tags,
        status: dto.status,
        expiresAt:
          dto.expiresAt === undefined
            ? undefined
            : dto.expiresAt
              ? new Date(dto.expiresAt)
              : null,
        history:
          changes.length > 0
            ? {
                create: {
                  label: 'Link Details Updated',
                  description: changes.join(' • '),
                  by: actor,
                },
              }
            : undefined,
        destinationHistory:
          dto.longUrl && dto.longUrl !== current.longUrl
            ? {
                updateMany: {
                  where: { linkId: id },
                  data: { isCurrent: false },
                },
                create: {
                  destinationUrl: dto.longUrl,
                  changedBy: actor,
                  isCurrent: true,
                },
              }
            : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.shortLink.delete({ where: { id } });
  }
}
