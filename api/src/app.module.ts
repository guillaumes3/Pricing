import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PricesModule } from './prices/prices.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const getEnv = (key: string): string | undefined => {
          const value = configService.get<string>(key);
          return value && value.trim().length > 0 ? value.trim() : undefined;
        };

        const supabaseUrl = getEnv('SUPABASE_URL');
        const inferredProjectIdFromUrl = supabaseUrl
          ? (() => {
              try {
                return new URL(supabaseUrl).hostname.split('.')[0];
              } catch {
                return undefined;
              }
            })()
          : undefined;

        const projectId = getEnv('SUPABASE_PROJECT_ID') ?? inferredProjectIdFromUrl;
        const inferredSupabaseHost = projectId ? `db.${projectId}.supabase.co` : undefined;
        const host = getEnv('DB_HOST') ?? inferredSupabaseHost ?? 'localhost';
        const dbSslRaw = getEnv('DB_SSL');
        const dbSslEnabled = dbSslRaw
          ? ['1', 'true', 'yes', 'on'].includes(dbSslRaw.toLowerCase())
          : host.endsWith('.supabase.co');
        const defaultDbName = host.endsWith('.supabase.co') ? 'postgres' : 'pricing';

        return {
          type: 'postgres',
          host,
          port: Number(getEnv('DB_PORT') ?? '5432'),
          username: getEnv('DB_USER') ?? 'postgres',
          password: getEnv('DB_PASSWORD') ?? 'postgres',
          database: getEnv('DB_NAME') ?? defaultDbName,
          ssl: dbSslEnabled ? { rejectUnauthorized: false } : false,
          autoLoadEntities: true,
          synchronize: false,
        };
      },
    }),
    PricesModule,
  ],
})
export class AppModule {}
