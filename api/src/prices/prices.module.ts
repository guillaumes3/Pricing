import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { PriceHistoryEntity } from './price-history.entity';
import { PricesController } from './prices.controller';
import { PricesService } from './prices.service';

@Module({
  imports: [TypeOrmModule.forFeature([PriceHistoryEntity])],
  controllers: [PricesController],
  providers: [PricesService, ApiKeyGuard],
})
export class PricesModule {}
