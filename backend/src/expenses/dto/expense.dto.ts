import { IsString, IsNumber, IsDateString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateExpenseDto {
  @ApiProperty() @IsString() description: string;
  @ApiProperty() @IsString() category: string;
  @ApiProperty() @IsNumber() amount: number;
  @ApiProperty() @IsDateString() expenseDate: string;
}

export class UpdateExpenseDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() category?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() amount?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() expenseDate?: string;
}
