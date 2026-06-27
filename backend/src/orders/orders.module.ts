import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';

@Module({
  imports: [MulterModule.register({ dest: './uploads' })],
  providers: [OrdersService],
  controllers: [OrdersController],
})
export class OrdersModule {}
