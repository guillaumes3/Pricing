import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TrackProductDto } from './track-product.dto';

interface PostgresError {
  code?: string;
  constraint?: string;
}

export interface TrackProductResponse {
  product: {
    id: number;
    name: string;
    sku: string;
    price: number;
    createdAt: string;
  };
  competitorLinks: Array<{
    competitorId: number;
    url: string;
  }>;
}

@Injectable()
export class ProductsService {
  constructor(private readonly dataSource: DataSource) {}

  async trackProduct(input: TrackProductDto): Promise<TrackProductResponse> {
    this.assertNoDuplicateCompetitors(input.competitorLinks.map((link) => link.competitorId));

    const normalizedName = input.name.trim();
    const normalizedSku = input.sku.trim();
    const normalizedLinks = input.competitorLinks.map((link) => ({
      competitorId: link.competitorId,
      url: link.url.trim(),
    }));

    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existingSkuResult = await queryRunner.query(
        `
          SELECT EXISTS (
            SELECT 1
            FROM products
            WHERE sku = $1
          ) AS exists
        `,
        [normalizedSku],
      );
      const existingSku = existingSkuResult as Array<{ exists: boolean }>;

      if (existingSku[0]?.exists) {
        throw new ConflictException(`A product with SKU \"${normalizedSku}\" already exists`);
      }

      const distinctCompetitorIds = [...new Set(normalizedLinks.map((link) => link.competitorId))];
      const foundCompetitorsResult = await queryRunner.query(
        'SELECT id FROM competitors WHERE id = ANY($1::int[])',
        [distinctCompetitorIds],
      );
      const foundCompetitors = foundCompetitorsResult as Array<{ id: number }>;

      const foundIds = new Set(foundCompetitors.map((competitor) => Number(competitor.id)));
      const missingCompetitors = distinctCompetitorIds.filter((competitorId) => !foundIds.has(competitorId));

      if (missingCompetitors.length > 0) {
        throw new NotFoundException(
          `Unknown competitor id(s): ${missingCompetitors.sort((a, b) => a - b).join(', ')}`,
        );
      }

      const insertedProductsResult = await queryRunner.query(
        `
          INSERT INTO products (name, sku, created_at, updated_at)
          VALUES ($1, $2, NOW(), NOW())
          RETURNING id, name, sku, created_at
        `,
        [normalizedName, normalizedSku],
      );
      const insertedProducts = insertedProductsResult as Array<{
        id: number;
        name: string;
        sku: string;
        created_at: Date;
      }>;

      const createdProduct = insertedProducts[0];

      await queryRunner.query(
        `
          INSERT INTO price_history (competitor_id, product_id, price, currency, recorded_at, scraped_at)
          VALUES (NULL, $1, $2, 'EUR', NOW(), NOW())
        `,
        [createdProduct.id, input.price],
      );

      for (const link of normalizedLinks) {
        await queryRunner.query(
          `
            INSERT INTO product_competitor_links (product_id, competitor_id, url, created_at, updated_at)
            VALUES ($1, $2, $3, NOW(), NOW())
          `,
          [createdProduct.id, link.competitorId, link.url],
        );
      }

      const createdLinksResult = await queryRunner.query(
        `
          SELECT competitor_id AS "competitorId", url
          FROM product_competitor_links
          WHERE product_id = $1
          ORDER BY competitor_id ASC
        `,
        [createdProduct.id],
      );
      const createdLinks = createdLinksResult as Array<{ competitorId: number; url: string }>;

      await queryRunner.commitTransaction();

      return {
        product: {
          id: createdProduct.id,
          name: createdProduct.name,
          sku: createdProduct.sku,
          price: input.price,
          createdAt: new Date(createdProduct.created_at).toISOString(),
        },
        competitorLinks: createdLinks,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();

      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      const pgError = error as PostgresError;

      if (pgError.code === '23505' && pgError.constraint === 'products_sku_key') {
        throw new ConflictException(`A product with SKU \"${normalizedSku}\" already exists`);
      }

      if (pgError.code === '23505' && pgError.constraint === 'uq_product_competitor_links_product_competitor') {
        throw new ConflictException('A competitor link already exists for this product');
      }

      if (pgError.code === '23503' && pgError.constraint === 'fk_product_competitor_links_competitor') {
        throw new NotFoundException('One or more competitors do not exist');
      }

      throw new InternalServerErrorException('Unable to track product at this time');
    } finally {
      await queryRunner.release();
    }
  }

  private assertNoDuplicateCompetitors(competitorIds: number[]): void {
    const unique = new Set<number>();

    for (const competitorId of competitorIds) {
      if (unique.has(competitorId)) {
        throw new BadRequestException(
          `Duplicate competitorId ${competitorId} detected. Only one URL per competitor is allowed.`,
        );
      }

      unique.add(competitorId);
    }
  }
}
