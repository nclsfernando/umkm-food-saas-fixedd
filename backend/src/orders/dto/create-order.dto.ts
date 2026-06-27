import { IsEnum, IsDateString, IsOptional, IsNumber, IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum Marketplace { GOFOOD = 'GOFOOD', GRABFOOD = 'GRABFOOD', SHOPEEFOOD = 'SHOPEEFOOD' }
export enum OrderStatus { COMPLETED = 'COMPLETED', CANCELLED = 'CANCELLED', REFUNDED = 'REFUNDED' }

export class OrderItemDto {
  @ApiProperty() @IsString() productName: string;
  @ApiProperty() @IsNumber() qty: number;
  @ApiProperty() @IsNumber() unitPrice: number;
  @ApiProperty() @IsNumber() subtotal: number;
}

export class CreateOrderDto {
  @ApiProperty({ enum: Marketplace }) @IsEnum(Marketplace) marketplace: Marketplace;
  @ApiProperty() @IsString() orderId: string;
  @ApiProperty() @IsDateString() orderDate: string;
  @ApiProperty() @IsNumber() grossSales: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() discount?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() commission?: number;
  @ApiProperty() @IsNumber() netSales: number;
  @ApiProperty({ enum: OrderStatus, required: false }) @IsOptional() @IsEnum(OrderStatus) status?: OrderStatus;
  @ApiProperty({ type: [OrderItemDto], required: false }) @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => OrderItemDto) items?: OrderItemDto[];
}
