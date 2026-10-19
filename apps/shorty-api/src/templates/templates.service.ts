import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.qRTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const template = await this.prisma.qRTemplate.findUnique({ where: { id } });
    if (!template)
      throw new NotFoundException(`Template with ID ${id} not found`);
    return template;
  }

  create(dto: CreateTemplateDto) {
    return this.prisma.qRTemplate.create({
      data: { ...dto, isCustom: true },
    });
  }

  async update(id: string, dto: UpdateTemplateDto) {
    await this.findOne(id);
    return this.prisma.qRTemplate.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.qRTemplate.delete({ where: { id } });
  }
}
