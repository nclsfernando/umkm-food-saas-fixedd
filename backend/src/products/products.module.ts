import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ProductsImportService } from './products-import.service';
import { ProductsImportController } from './products-import.controller';

@Module({
  providers: [ProductsService, ProductsImportService],
  controllers: [ProductsController, ProductsImportController],
})
export class ProductsModule {}
