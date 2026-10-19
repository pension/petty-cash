import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  BifrostUser,
  IdentityGuard,
  PermissionGuard,
  type AuthUser,
} from '@pension/midgard';
import { LinksService } from './links.service';
import { CreateLinkDto } from './dto/create-link.dto';
import { UpdateLinkDto } from './dto/update-link.dto';
import { QueryLinksDto } from './dto/query-links.dto';

@UseGuards(IdentityGuard, PermissionGuard)
@Controller('api/v1/shorturl/links')
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @Get()
  findAll(@Query() query: QueryLinksDto) {
    return this.linksService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.linksService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateLinkDto, @BifrostUser() user: AuthUser) {
    return this.linksService.create(dto, user?.name ?? 'Unknown');
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLinkDto,
    @BifrostUser() user: AuthUser,
  ) {
    return this.linksService.update(id, dto, user?.name ?? 'Unknown');
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.linksService.remove(id);
  }
}
