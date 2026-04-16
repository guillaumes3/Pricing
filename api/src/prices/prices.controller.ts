import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { PricesService } from './prices.service';
import { PriceHistoryChartResponse } from './prices.types';

@Controller('prices')
@UseGuards(ApiKeyGuard)
export class PricesController {
  constructor(private readonly pricesService: PricesService) {}

  @Get(':id/history')
  getPriceHistory(@Param('id', ParseIntPipe) id: number): Promise<PriceHistoryChartResponse> {
    return this.pricesService.getPriceHistoryForChart(id);
  }
}
