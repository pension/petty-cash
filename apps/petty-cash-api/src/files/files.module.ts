import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
@Module({
  imports: [AuthModule, CommonModule],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
