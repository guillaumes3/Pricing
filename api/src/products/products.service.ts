import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { DataSource, QueryFailedError, QueryRunner } from 'typeorm';
import { TrackProductDto } from './track-product.dto';

interface CompetitorRow {
  id: number;
  name: string;
  domain: string;
}

interface LinkRow {
  competitorId: number;
  competitorName: string;
  url: string;
}

interface NormalizedLink {
  competitorName: string;
  competitorKey: string;
  url: string;
  domain: string;
}

interface UpsertedProductRow {
  id: number;
  wasCreated: boolean | 't' | 'f' | 1 | 0;
}

export interface TrackProductResponse {
  productId: number;
  sku: string;
  wasCreated: boolean;
  links: LinkRow[];
}

@Injectable()
export class ProductsService {
  constructor(private readonly dataSource: DataSource) {}

  async trackProduct(input: TrackProductDto): Promise<TrackProductResponse> {
    const sku = input.sku.trim();
    const productName = input.name.trim();

    const normalizedLinks: NormalizedLink[] = input.links.map((link) => {
      const competitorName = link.competitorName.trim();
      const url = link.url.trim();

      return {
        competitorName,
        competitorKey: this.normalizeCompetitorName(competitorName),
        url,
        domain: this.extractDomain(url),
      };
    });

    this.assertNoDuplicateCompetitors(normalizedLinks);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { productId, wasCreated } = await this.upsertProduct(queryRunner, {
        sku,
        name: productName,
        ean: input.ean?.trim(),
        brand: input.brand?.trim(),
        category: input.category?.trim(),
        canonicalUrl: input.canonicalUrl?.trim(),
      });

      const competitorByKey = await this.resolveOrCreateCompetitors(queryRunner, normalizedLinks);
      await this.upsertProductCompetitorLinks(queryRunner, productId, normalizedLinks, competitorByKey);

      const persistedLinks = await this.getProductLinks(queryRunner, productId);

      await queryRunner.commitTransaction();

      return {
        productId,
        sku,
        wasCreated,
        links: persistedLinks,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();

      if (error instanceof BadRequestException || error instanceof ConflictException) {
        throw error;
      }

      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'Unique constraint violation while tracking product (possibly competitor name/domain).',
        );
      }

      throw new InternalServerErrorException('Unable to track product at this time');
    } finally {
      await queryRunner.release();
    }
  }

  private async upsertProduct(
    queryRunner: QueryRunner,
    payload: {
      sku: string;
      name: string;
      ean?: string;
      brand?: string;
      category?: string;
      canonicalUrl?: string;
    },
  ): Promise<{ productId: number; wasCreated: boolean }> {
    const rows = (await queryRunner.query(
      `
        INSERT INTO products (sku, name, ean, brand, category, canonical_url, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (sku) DO UPDATE
          SET name = EXCLUDED.name,
              ean = COALESCE(EXCLUDED.ean, products.ean),
              brand = COALESCE(EXCLUDED.brand, products.brand),
              category = COALESCE(EXCLUDED.category, products.category),
              canonical_url = COALESCE(EXCLUDED.canonical_url, products.canonical_url),
              updated_at = NOW()
        RETURNING id, (xmax = 0) AS "wasCreated"
      `,
      [
        payload.sku,
        payload.name,
        payload.ean ?? null,
        payload.brand ?? null,
        payload.category ?? null,
        payload.canonicalUrl ?? null,
      ],
    )) as UpsertedProductRow[];

    if (rows.length === 0) {
      throw new InternalServerErrorException('Unable to create or update product');
    }

    return {
      productId: Number(rows[0].id),
      wasCreated: this.parsePgBoolean(rows[0].wasCreated),
    };
  }

  private async resolveOrCreateCompetitors(
    queryRunner: QueryRunner,
    links: NormalizedLink[],
  ): Promise<Map<string, CompetitorRow>> {
    const uniqueByKey = new Map<string, { competitorName: string; domain: string }>();

    links.forEach((link) => {
      if (!uniqueByKey.has(link.competitorKey)) {
        uniqueByKey.set(link.competitorKey, {
          competitorName: link.competitorName,
          domain: link.domain,
        });
      }
    });

    const competitorKeys = [...uniqueByKey.keys()];
    let competitorRows = await this.findCompetitorsByNormalizedNames(queryRunner, competitorKeys);
    let competitorByKey = new Map<string, CompetitorRow>(
      competitorRows.map((row) => [this.normalizeCompetitorName(row.name), row]),
    );

    const missingKeys = competitorKeys.filter((key) => !competitorByKey.has(key));

    if (missingKeys.length > 0) {
      const missingNames = missingKeys.map((key) => uniqueByKey.get(key)!.competitorName);
      const missingDomains = missingKeys.map((key) => uniqueByKey.get(key)!.domain);

      await queryRunner.query(
        `
          INSERT INTO competitors (name, domain, updated_at)
          SELECT candidate.name, candidate.domain, NOW()
          FROM UNNEST($1::text[], $2::text[]) AS candidate(name, domain)
          ON CONFLICT (name) DO UPDATE
            SET updated_at = NOW()
        `,
        [missingNames, missingDomains],
      );

      competitorRows = await this.findCompetitorsByNormalizedNames(queryRunner, competitorKeys);
      competitorByKey = new Map<string, CompetitorRow>(
        competitorRows.map((row) => [this.normalizeCompetitorName(row.name), row]),
      );
    }

    const unresolved = competitorKeys.filter((key) => !competitorByKey.has(key));
    if (unresolved.length > 0) {
      throw new InternalServerErrorException('Unable to resolve competitor ids for all links');
    }

    return competitorByKey;
  }

  private async upsertProductCompetitorLinks(
    queryRunner: QueryRunner,
    productId: number,
    links: NormalizedLink[],
    competitorByKey: Map<string, CompetitorRow>,
  ): Promise<void> {
    const competitorIds: number[] = [];
    const urls: string[] = [];

    links.forEach((link) => {
      const competitor = competitorByKey.get(link.competitorKey);

      if (!competitor) {
        throw new InternalServerErrorException(
          `Missing competitor ID for "${link.competitorName}" during link upsert`,
        );
      }

      competitorIds.push(competitor.id);
      urls.push(link.url);
    });

    await queryRunner.query(
      `
        INSERT INTO product_competitor_links (product_id, competitor_id, url, updated_at)
        SELECT $1::int, payload.competitor_id, payload.url, NOW()
        FROM UNNEST($2::int[], $3::text[]) AS payload(competitor_id, url)
        ON CONFLICT (product_id, competitor_id) DO UPDATE
          SET url = EXCLUDED.url,
              updated_at = NOW()
      `,
      [productId, competitorIds, urls],
    );
  }

  private async getProductLinks(queryRunner: QueryRunner, productId: number): Promise<LinkRow[]> {
    return (await queryRunner.query(
      `
        SELECT
          pcl.competitor_id AS "competitorId",
          c.name AS "competitorName",
          pcl.url AS "url"
        FROM product_competitor_links pcl
        INNER JOIN competitors c ON c.id = pcl.competitor_id
        WHERE pcl.product_id = $1
        ORDER BY c.name ASC
      `,
      [productId],
    )) as LinkRow[];
  }

  private async findCompetitorsByNormalizedNames(
    queryRunner: QueryRunner,
    normalizedNames: string[],
  ): Promise<CompetitorRow[]> {
    if (normalizedNames.length === 0) {
      return [];
    }

    return (await queryRunner.query(
      `
        SELECT id, name, domain
        FROM competitors
        WHERE LOWER(BTRIM(name)) = ANY($1::text[])
      `,
      [normalizedNames],
    )) as CompetitorRow[];
  }

  private assertNoDuplicateCompetitors(links: NormalizedLink[]): void {
    const seen = new Set<string>();

    links.forEach((link) => {
      if (seen.has(link.competitorKey)) {
        throw new BadRequestException(
          `Duplicate competitor "${link.competitorName}" detected. One link per competitor is allowed.`,
        );
      }

      seen.add(link.competitorKey);
    });
  }

  private extractDomain(rawUrl: string): string {
    let parsed: URL;

    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new BadRequestException(`Invalid URL: "${rawUrl}"`);
    }

    const hostname = parsed.hostname.trim().toLowerCase().replace(/\.$/, '');
    const normalizedHost = hostname.replace(/^www\./, '');

    if (!normalizedHost || !normalizedHost.includes('.')) {
      throw new BadRequestException(`Unable to extract domain from URL: "${rawUrl}"`);
    }

    return normalizedHost;
  }

  private normalizeCompetitorName(value: string): string {
    return value.trim().toLowerCase();
  }

  private parsePgBoolean(value: UpsertedProductRow['wasCreated']): boolean {
    return value === true || value === 't' || value === 1;
  }

  private isUniqueViolation(error: unknown): boolean {
    if (error instanceof QueryFailedError) {
      const pgCode = (error as QueryFailedError & { driverError?: { code?: string } }).driverError
        ?.code;
      return pgCode === '23505';
    }

    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    );
  }
}
