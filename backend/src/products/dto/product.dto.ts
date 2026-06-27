import { IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() categoryId: string;
  @ApiProperty() @IsNumber() sellingPrice: number;
  @ApiProperty() @IsNumber() hpp: number;
}

export class UpdateProductDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() name?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() categoryId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() sellingPrice?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() hpp?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isActive?: boolean;
}
