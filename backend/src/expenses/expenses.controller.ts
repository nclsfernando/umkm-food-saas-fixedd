import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Request, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/expense.dto';

@ApiTags('Expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private expenses: ExpensesService) {}

  @Get()
  findAll(
    @Request() req,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) { return this.expenses.findAll(req.user.id, from, to, page, limit); }

  @Post()
  create(@Request() req, @Body() dto: CreateExpenseDto) { return this.expenses.create(req.user.id, dto); }

  @Get('summary')
  @ApiOperation({ summary: 'Ringkasan biaya per kategori' })
  summary(@Request() req, @Query('from') from: string, @Query('to') to: string) {
    return this.expenses.summary(req.user.id, from, to);
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.expenses.findOne(id); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateExpenseDto) { return this.expenses.update(id, dto); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.expenses.remove(id); }
}
