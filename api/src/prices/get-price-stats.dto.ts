import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsISO8601, IsInt, IsOptional, Min } from 'class-validator';

const emptyStringToUndefined = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
};

export class GetPriceStatsDto {
  @ApiPropertyOptional({
    description: 'Inclusive lower bound for statistics filtering (ISO-8601 date-time).',
    type: String,
    format: 'date-time',
    example: '2026-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsISO8601(
    { strict: true, strictSeparator: true },
    { message: 'startDate must be a valid ISO-8601 date-time' },
  )
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Inclusive upper bound for statistics filtering (ISO-8601 date-time).',
    type: String,
    format: 'date-time',
    example: '2026-01-31T23:59:59.999Z',
  })
  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsISO8601(
    { strict: true, strictSeparator: true },
    { message: 'endDate must be a valid ISO-8601 date-time' },
  )
  endDate?: string;

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
