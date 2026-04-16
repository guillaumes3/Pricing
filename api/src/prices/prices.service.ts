import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GetPriceHistoryDto } from './get-price-history.dto';
import { GetPriceStatsDto } from './get-price-stats.dto';
import { PriceHistoryEntity } from './price-history.entity';
import { PriceHistoryChartResponse } from './prices.types';

interface PriceFilters {
  startDate?: Date;
  endDate?: Date;
  competitorId?: number;
}

@Injectable()
export class PricesRepository {
  constructor(
    @InjectRepository(PriceHistoryEntity)
    private readonly priceHistoryRepository: Repository<PriceHistoryEntity>,
  ) {}

  async productExists(productId: number): Promise<boolean> {
    const rows = await this.priceHistoryRepository.manager.query(
      'SELECT 1 FROM products WHERE id = $1 LIMIT 1',
      [productId],
    );

    return rows.length > 0;
  }

  async findPriceHistory(productId: number, filters: GetPriceHistoryDto): Promise<PriceHistoryEntity[]> {
    const queryBuilder = this.priceHistoryRepository
      .createQueryBuilder('priceHistory')
      .where('priceHistory.productId = :productId', { productId });

    if (filters.startDate) {
      queryBuilder.andWhere('priceHistory.recordedAt >= :startDate', { startDate: filters.startDate });
    }

    if (filters.endDate) {
      queryBuilder.andWhere('priceHistory.recordedAt <= :endDate', { endDate: filters.endDate });
    }

    if (filters.competitorId) {
      queryBuilder.andWhere('priceHistory.competitor_id = :competitorId', {
        competitorId: filters.competitorId,
      });
    }

    return queryBuilder.orderBy('priceHistory.recordedAt', 'ASC').getMany();
  }

  async getGlobalStats(filters: PriceFilters): Promise<GlobalPriceStatsResponse['summary']> {
    const queryBuilder = this.priceHistoryRepository
      .createQueryBuilder('priceHistory')
      .select('COUNT(priceHistory.id)', 'observationsCount')
      .addSelect('COUNT(DISTINCT priceHistory.productId)', 'productsCount')
      .addSelect('MIN(priceHistory.price)', 'minPrice')
      .addSelect('MAX(priceHistory.price)', 'maxPrice')
      .addSelect('AVG(priceHistory.price)', 'avgPrice')
      .addSelect('MAX(priceHistory.recordedAt)', 'latestRecordedAt');

    if (filters.startDate) {
      queryBuilder.andWhere('priceHistory.recordedAt >= :startDate', { startDate: filters.startDate });
    }

    if (filters.endDate) {
      queryBuilder.andWhere('priceHistory.recordedAt <= :endDate', { endDate: filters.endDate });
    }

    if (filters.competitorId) {
      queryBuilder.andWhere('priceHistory.competitor_id = :competitorId', {
        competitorId: filters.competitorId,
      });
    }

    const rawStats = await queryBuilder.getRawOne<{
      observationsCount: string;
      productsCount: string;
      minPrice: string | null;
      maxPrice: string | null;
      avgPrice: string | null;
      latestRecordedAt: Date | null;
    }>();

    const observationsCount = Number(rawStats?.observationsCount ?? 0);
    const productsCount = Number(rawStats?.productsCount ?? 0);

    return {
      observationsCount,
      productsCount,
      minPrice: rawStats?.minPrice ? Number(rawStats.minPrice) : null,
      maxPrice: rawStats?.maxPrice ? Number(rawStats.maxPrice) : null,
      avgPrice: rawStats?.avgPrice ? Number(rawStats.avgPrice) : null,
      latestRecordedAt: rawStats?.latestRecordedAt ? new Date(rawStats.latestRecordedAt).toISOString() : null,
    };
  }
}

export interface GlobalPriceStatsResponse {
  filters: {
    startDate?: string;
    endDate?: string;
    competitorId?: number;
  };
  summary: {
    observationsCount: number;
    productsCount: number;
    minPrice: number | null;
    maxPrice: number | null;
    avgPrice: number | null;
    latestRecordedAt: string | null;
  };
}

@Injectable()
export class PricesService {
  constructor(private readonly pricesRepository: PricesRepository) {}

  async getPriceHistoryForChart(productId: number, filters: GetPriceHistoryDto): Promise<PriceHistoryChartResponse> {
    this.validateDateRange(filters);

    const productExists = await this.pricesRepository.productExists(productId);
    if (!productExists) {
      throw new NotFoundException(`Product ${productId} does not exist`);
    }

    const history = await this.pricesRepository.findPriceHistory(productId, filters);

    if (history.length === 0) {
      throw new NotFoundException(`No price history found for product ${productId} with the requested filters`);
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

  async getGlobalPriceStats(filters: GetPriceStatsDto): Promise<GlobalPriceStatsResponse> {
    const normalizedFilters = this.normalizeStatsFilters(filters);

    this.validateDateRange(normalizedFilters);

    const summary = await this.pricesRepository.getGlobalStats(normalizedFilters);

    return {
      filters: {
        startDate: normalizedFilters.startDate?.toISOString(),
        endDate: normalizedFilters.endDate?.toISOString(),
        competitorId: normalizedFilters.competitorId,
      },
      summary,
    };
  }

  private validateDateRange(filters: PriceFilters): void {
    if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
      throw new BadRequestException('startDate must be less than or equal to endDate');
    }
  }

  private normalizeStatsFilters(filters: GetPriceStatsDto): PriceFilters {
    return {
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
      competitorId: filters.competitorId,
    };
  }
}
