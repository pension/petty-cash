import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IdentityGuard, PermissionGuard } from '@pension/midgard';
import { FramesService } from './frames.service';
import { CreateFrameDto } from './dto/create-frame.dto';
import { UpdateFrameDto } from './dto/update-frame.dto';

@UseGuards(IdentityGuard, PermissionGuard)
@Controller('api/v1/shorturl/frames')
export class FramesController {
  constructor(private readonly framesService: FramesService) {}

  @Get()
  findAll() {
    return this.framesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.framesService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateFrameDto) {
    return this.framesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFrameDto) {
    return this.framesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.framesService.remove(id);
  }
}
