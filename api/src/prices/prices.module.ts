import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { redisStore } from 'cache-manager-redis-yet';
import { PriceHistoryEntity } from './price-history.entity';
import { JwtPricesAuthGuard, PricesController } from './prices.controller';
import { PricesRepository, PricesService } from './prices.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PriceHistoryEntity]),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),
    CacheModule.registerAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisHost = configService.get<string>('REDIS_HOST');
        const redisPort = Number(configService.get<string>('REDIS_PORT') ?? 6379);
        const redisPassword = configService.get<string>('REDIS_PASSWORD');
        const redisDb = Number(configService.get<string>('REDIS_DB') ?? 0);

        if (!redisHost) {
          return { ttl: 300000 };
        }

        return {
          ttl: 300000,
          store: await redisStore({
            socket: {
              host: redisHost,
              port: redisPort,
            },
            password: redisPassword,
            database: redisDb,
          }),
        };
      },
    }),
  ],
  controllers: [PricesController],
  providers: [PricesService, PricesRepository, JwtPricesAuthGuard],
})
export class PricesModule {}
