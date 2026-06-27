import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Get('profit-loss')
  @ApiOperation({ summary: 'Laporan Laba Rugi' })
  profitLoss(@Query('from') from: string, @Query('to') to: string) {
    return this.reports.profitLoss(from, to);
  }

  @Get('marketplace')
  @ApiOperation({ summary: 'Ringkasan per marketplace' })
  marketplace(@Query('from') from: string, @Query('to') to: string) {
    return this.reports.marketplaceSummary(from, to);
  }
}
