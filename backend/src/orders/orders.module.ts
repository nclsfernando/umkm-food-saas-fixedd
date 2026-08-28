import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { ImportService } from './import.service';
import { ImportController } from './import.controller';

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  ],
  providers: [OrdersService, ImportService],
  controllers: [OrdersController, ImportController],
})
export class OrdersModule {}
