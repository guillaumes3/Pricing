import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { TrackProductDto } from './track-product.dto';
import { ProductsService, TrackProductResponse } from './products.service';

@ApiTags('products')
@Controller('products')
@UseGuards(ApiKeyGuard)
@ApiHeader({
  name: 'x-api-key',
  required: true,
  description: 'API key used to authenticate scraper write operations.',
})
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post('track')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a product and attach exact competitor URLs to monitor',
  })
  @ApiCreatedResponse({ description: 'Product and competitor links created successfully' })
  @ApiBadRequestResponse({ description: 'Payload validation failed or duplicate competitor ids were provided' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid API key' })
  @ApiConflictResponse({ description: 'SKU already exists or a duplicate link already exists' })
  @ApiNotFoundResponse({ description: 'One or more competitor ids do not exist' })
  trackProduct(@Body() payload: TrackProductDto): Promise<TrackProductResponse> {
    return this.productsService.trackProduct(payload);
  }
}
