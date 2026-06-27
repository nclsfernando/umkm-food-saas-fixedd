import { Controller, Get, Query, UseGuards, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboard: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Ringkasan hari ini, minggu, bulan' })
  summary() { return this.dashboard.getSummary(); }

  @Get('marketplace')
  @ApiOperation({ summary: 'Breakdown per marketplace' })
  marketplace(@Query('from') from: string, @Query('to') to: string) {
    return this.dashboard.getMarketplaceBreakdown(from, to);
  }

  @Get('chart/daily')
  @ApiOperation({ summary: 'Grafik harian per bulan' })
  dailyChart(
    @Query('year', new DefaultValuePipe(new Date().getFullYear()), ParseIntPipe) year: number,
    @Query('month', new DefaultValuePipe(new Date().getMonth() + 1), ParseIntPipe) month: number,
  ) { return this.dashboard.getDailyChart(year, month); }

  @Get('top-products')
  @ApiOperation({ summary: 'Produk terlaris' })
  topProducts(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) { return this.dashboard.getTopProducts(from, to, limit); }
}
