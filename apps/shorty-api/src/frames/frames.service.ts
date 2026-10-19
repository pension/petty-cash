import { Injectable, NotFoundException } from '@nestjs/common';
import { QRFrame } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  FRAME_TYPE_PRISMA_TO_WIRE,
  FRAME_TYPE_WIRE_TO_PRISMA,
} from '../common/frame-type.util';
import { CreateFrameDto } from './dto/create-frame.dto';
import { UpdateFrameDto } from './dto/update-frame.dto';

function toWire(frame: QRFrame) {
  return { ...frame, frameType: FRAME_TYPE_PRISMA_TO_WIRE[frame.frameType] };
}

@Injectable()
export class FramesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const frames = await this.prisma.qRFrame.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return frames.map(toWire);
  }

  async findOne(id: string) {
    const frame = await this.prisma.qRFrame.findUnique({ where: { id } });
    if (!frame) throw new NotFoundException(`Frame with ID ${id} not found`);
    return toWire(frame);
  }

  async create(dto: CreateFrameDto) {
    const frame = await this.prisma.qRFrame.create({
      data: {
        ...dto,
        frameType: dto.frameType
          ? FRAME_TYPE_WIRE_TO_PRISMA[dto.frameType]
          : undefined,
        isCustom: true,
      },
    });
    return toWire(frame);
  }

  async update(id: string, dto: UpdateFrameDto) {
    await this.findOne(id);
    const frame = await this.prisma.qRFrame.update({
      where: { id },
      data: {
        ...dto,
        frameType: dto.frameType
          ? FRAME_TYPE_WIRE_TO_PRISMA[dto.frameType]
          : undefined,
      },
    });
    return toWire(frame);
  }

  async remove(id: string) {
    await this.findOne(id);
    // QRTemplate.frameId and QRCode.frameId are onDelete: SetNull in the
    // schema, so referencing rows are nullified automatically — no manual
    // cleanup needed here (unlike the mock store's hand-rolled version).
    return this.prisma.qRFrame.delete({ where: { id } });
  }
}
