import { Controller, Post, UploadedFile, UseGuards, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ImportService } from './import.service';

@ApiTags('Import')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders/import')
export class ImportController {
  constructor(private importService: ImportService) {}

  @Post()
  @ApiOperation({ summary: 'Import mutasi dari GrabFood / GoFood / ShopeeFood' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async import(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File tidak ditemukan');
    return this.importService.importFile(file.buffer, file.originalname);
  }

  @Post('clean-duplicates')
  @ApiOperation({ summary: 'Hapus transaksi duplikat yang sudah tersimpan' })
  async cleanDuplicates() {
    return this.importService.cleanDuplicates();
  }

  @Post('delete-all')
  @ApiOperation({ summary: 'Hapus SEMUA data pesanan (reset total)' })
  async deleteAll() {
    return this.importService.deleteAllOrders();
  }

  @Post('recalculate-net')
  @ApiOperation({ summary: 'Recalculate netSales semua order: grossSales - commission' })
  async recalculateNet() {
    return this.importService.recalculateNetSales();
  }
}
