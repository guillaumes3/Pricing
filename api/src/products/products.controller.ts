import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
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
  description: 'API key requise pour les opérations d\'écriture.',
})
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post('track')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Créer/synchroniser un produit et ses liens concurrents' })
  @ApiCreatedResponse({ description: 'Produit suivi avec succès' })
  @ApiBadRequestResponse({ description: 'Payload invalide' })
  @ApiConflictResponse({
    description:
      'Conflit de contrainte en base (ex: domaine concurrent déjà utilisé par un autre nom).',
  })
  @ApiUnauthorizedResponse({ description: 'Clé API manquante ou invalide' })
  async trackProduct(@Body() payload: TrackProductDto): Promise<TrackProductResponse> {
    return this.productsService.trackProduct(payload);
  }
}
