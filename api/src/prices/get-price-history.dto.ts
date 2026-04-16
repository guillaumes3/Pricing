import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, Min } from 'class-validator';

export class GetPriceHistoryDto {
  @ApiPropertyOptional({
    description: 'Inclusive lower bound for price history filtering (ISO-8601 date-time).',
    type: String,
    format: 'date-time',
    example: '2026-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @ApiPropertyOptional({
    description: 'Inclusive upper bound for price history filtering (ISO-8601 date-time).',
    type: String,
    format: 'date-time',
    example: '2026-01-31T23:59:59.999Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @ApiPropertyOptional({
    description: 'Filter by competitor identifier.',
    type: Number,
    minimum: 1,
    example: 12,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  competitorId?: number;
}
