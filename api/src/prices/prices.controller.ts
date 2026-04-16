import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import {
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  Param,
  ParseIntPipe,
  Query,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { verify } from 'jsonwebtoken';
import { GetPriceHistoryDto } from './get-price-history.dto';
import { GlobalPriceStatsResponse, PricesService } from './prices.service';
import { PriceHistoryChartResponse } from './prices.types';

@Injectable()
export class JwtPricesAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new UnauthorizedException('JWT secret is not configured');
    }

    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: unknown }>();
    const authorizationHeader = request.headers.authorization;

    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    const token = authorizationHeader.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    try {
      request.user = verify(token, jwtSecret);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired JWT token');
    }
  }
}

@ApiTags('prices')
@ApiBearerAuth('jwt')
@Controller('prices')
@UseGuards(ThrottlerGuard, JwtPricesAuthGuard)
@Throttle({ default: { limit: 60, ttl: 60000 } })
export class PricesController {
  constructor(private readonly pricesService: PricesService) {}

  @Get('stats/global')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300)
  @ApiOperation({ summary: 'Return aggregated global pricing statistics' })
  @ApiQuery({
    name: 'startDate',
    required: false,
    schema: { type: 'string', format: 'date-time' },
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    schema: { type: 'string', format: 'date-time' },
  })
  @ApiQuery({
    name: 'competitorId',
    required: false,
    schema: { type: 'integer', minimum: 1 },
  })
  @ApiOkResponse({ description: 'Global statistics retrieved successfully' })
  @ApiBadRequestResponse({ description: 'Query parameters are invalid' })
  @ApiUnauthorizedResponse({ description: 'JWT is missing or invalid' })
  getGlobalStats(@Query() query: GetPriceHistoryDto): Promise<GlobalPriceStatsResponse> {
    return this.pricesService.getGlobalPriceStats(query);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get product price history points and summary statistics' })
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
    description: 'Product identifier',
    example: 42,
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    schema: { type: 'string', format: 'date-time' },
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    schema: { type: 'string', format: 'date-time' },
  })
  @ApiQuery({
    name: 'competitorId',
    required: false,
    schema: { type: 'integer', minimum: 1 },
  })
  @ApiOkResponse({ description: 'Price history retrieved successfully' })
  @ApiBadRequestResponse({ description: 'Query parameters are invalid' })
  @ApiUnauthorizedResponse({ description: 'JWT is missing or invalid' })
  @ApiNotFoundResponse({ description: 'Product was not found or has no price history' })
  getPriceHistory(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: GetPriceHistoryDto,
  ): Promise<PriceHistoryChartResponse> {
    return this.pricesService.getPriceHistoryForChart(id, query);
  }
}
