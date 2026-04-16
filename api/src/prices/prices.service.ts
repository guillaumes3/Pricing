import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PriceHistoryEntity } from './price-history.entity';
import { PriceHistoryChartResponse } from './prices.types';

@Injectable()
export class PricesService {
  constructor(
    @InjectRepository(PriceHistoryEntity)
    private readonly priceHistoryRepository: Repository<PriceHistoryEntity>,
  ) {}

  async getPriceHistoryForChart(productId: number): Promise<PriceHistoryChartResponse> {
    const history = await this.priceHistoryRepository.find({
      where: { productId },
      order: { recordedAt: 'ASC' },
    });

    if (history.length === 0) {
      throw new NotFoundException(`No price history found for product ${productId}`);
    }

    const points = history.map((entry) => ({
      x: entry.recordedAt.toISOString(),
      y: entry.price,
    }));

    const values = points.map((point) => point.y);

    return {
      productId,
      currency: history[0].currency,
      points,
      summary: {
        min: Math.min(...values),
        max: Math.max(...values),
        latest: values[values.length - 1],
        firstRecordedAt: points[0].x,
        lastRecordedAt: points[points.length - 1].x,
      },
    };
  }
}
