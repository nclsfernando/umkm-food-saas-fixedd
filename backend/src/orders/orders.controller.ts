import { Controller, Get, Post, Param, Query, Body, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private orders: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar order dengan filter' })
  findAll(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('marketplace') marketplace?: string,
    @Query('status') status?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    return this.orders.findAll({ from, to, marketplace, status, page, limit });
  }

  @Post()
  @ApiOperation({ summary: 'Tambah order manual' })
  create(@Body() dto: CreateOrderDto) { return this.orders.create(dto); }

  @Get(':id')
  @ApiOperation({ summary: 'Detail order' })
  findOne(@Param('id') id: string) { return this.orders.findOne(id); }
}
