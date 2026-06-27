import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
  constructor(private products: ProductsService) {}

  @Get('categories')
  @ApiOperation({ summary: 'Daftar kategori produk' })
  categories() { return this.products.findAllCategories(); }

  @Get()
  @ApiOperation({ summary: 'Daftar produk' })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) { return this.products.findAll(page, limit); }

  @Post()
  @ApiOperation({ summary: 'Tambah produk' })
  create(@Body() dto: CreateProductDto) { return this.products.create(dto); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.products.findOne(id); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) { return this.products.update(id, dto); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.products.remove(id); }
}
