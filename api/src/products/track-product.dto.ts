import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDefined,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class TrackProductLinkDto {
  @ApiProperty({
    description: 'Nom du concurrent tel qu\'il existe dans la table competitors (ex: Amazon, Cdiscount).',
    example: 'Amazon',
    maxLength: 100,
  })
  @IsDefined()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  competitorName!: string;

  @ApiProperty({
    description: 'URL produit du concurrent à surveiller.',
    example: 'https://www.amazon.fr/dp/B0C1234567',
    maxLength: 2048,
  })
  @IsDefined()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  url!: string;
}

export class TrackProductDto {
  @ApiProperty({
    description: 'Nom du produit à surveiller.',
    example: 'Apple AirPods Pro 2',
    maxLength: 255,
  })
  @IsDefined()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    description: 'SKU unique côté métier.',
    example: 'AIRPODS-PRO2-USB-C',
    maxLength: 128,
  })
  @IsDefined()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  sku!: string;

  @ApiProperty({
    description: 'Code EAN (optionnel).',
    example: '0195949772495',
    maxLength: 32,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  ean?: string;

  @ApiProperty({
    description: 'Marque du produit (optionnel).',
    example: 'Apple',
    maxLength: 120,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  brand?: string;

  @ApiProperty({
    description: 'Catégorie du produit (optionnel).',
    example: 'Ecouteurs',
    maxLength: 120,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  category?: string;

  @ApiProperty({
    description: 'URL canonique du produit (optionnel).',
    example: 'https://www.apple.com/fr/airpods-pro/',
    maxLength: 2048,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  canonicalUrl?: string;

  @ApiProperty({
    description: 'Liste des URL concurrentes à rattacher au produit.',
    type: [TrackProductLinkDto],
    minItems: 1,
    maxItems: 100,
  })
  @IsDefined()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique((link: TrackProductLinkDto) => link?.competitorName?.trim().toLowerCase())
  @ValidateNested({ each: true })
  @Type(() => TrackProductLinkDto)
  links!: TrackProductLinkDto[];
}
