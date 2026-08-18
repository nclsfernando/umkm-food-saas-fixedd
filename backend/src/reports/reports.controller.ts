import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
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
