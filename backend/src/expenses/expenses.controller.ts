import { Controller, Get, Post, Patch, Delete, Param, Body, Query, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/expense.dto';

@ApiTags('Expenses')
@Controller('expenses')
export class ExpensesController {
  constructor(private expenses: ExpensesService) {}

  @Get()
  findAll(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) { return this.expenses.findAll(from, to, page, limit); }

  @Post()
  create(@Body() dto: CreateExpenseDto) { return this.expenses.create(dto); }

  @Get('summary')
  @ApiOperation({ summary: 'Ringkasan biaya per kategori' })
  summary(@Query('from') from: string, @Query('to') to: string) {
    return this.expenses.summary(from, to);
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.expenses.findOne(id); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateExpenseDto) { return this.expenses.update(id, dto); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.expenses.remove(id); }
}
