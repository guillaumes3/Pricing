import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CompetitorLinkInputDto {
  @ApiProperty({
    description: 'Unique competitor identifier.',
    type: Number,
    minimum: 1,
    example: 3,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  competitorId!: number;

  @ApiProperty({
    description: 'Exact competitor product URL to monitor.',
    type: String,
    example: 'https://www.competitor.example/product/abc-123',
  })
  @IsString()
  @MaxLength(2048)
  @IsUrl({ require_protocol: true })
  url!: string;
}

export class TrackProductDto {
  @ApiProperty({
    description: 'Product name shown in your catalog.',
    type: String,
    maxLength: 255,
    example: 'Apple AirPods Pro 2',
  })
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    description: 'Internal or business SKU. Must be unique.',
    type: String,
    maxLength: 128,
    example: 'AIRPODS-PRO2-USB-C',
  })
  @IsString()
  @MaxLength(128)
  sku!: string;

  @ApiProperty({
    description: 'Current product selling price in EUR.',
    type: Number,
    minimum: 0,
    maximum: 9999999999.99,
    example: 279.99,
  })
  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999.99)
  price!: number;

  @ApiProperty({
    description: 'Competitor URLs linked to this product for tracking.',
    type: [CompetitorLinkInputDto],
    minItems: 1,
    maxItems: 100,
    example: [
      {
        competitorId: 1,
        url: 'https://www.amazon.fr/dp/B0C1234567',
      },
      {
        competitorId: 2,
        url: 'https://www.cdiscount.com/produit/airpods-pro-2.html',
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CompetitorLinkInputDto)
  competitorLinks!: CompetitorLinkInputDto[];
}
