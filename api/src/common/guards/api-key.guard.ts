import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const configuredApiKey = this.configService.get<string>('SCRAPER_API_KEY');

    if (!configuredApiKey) {
      throw new InternalServerErrorException('SCRAPER_API_KEY is not configured');
    }

    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const apiKeyHeader = request.headers['x-api-key'];

    if (typeof apiKeyHeader !== 'string' || !this.isValidApiKey(apiKeyHeader, configuredApiKey)) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }

  private isValidApiKey(receivedApiKey: string, configuredApiKey: string): boolean {
    const receivedBuffer = Buffer.from(receivedApiKey);
    const configuredBuffer = Buffer.from(configuredApiKey);

    if (receivedBuffer.length !== configuredBuffer.length) {
      return false;
    }

    return timingSafeEqual(receivedBuffer, configuredBuffer);
  }
}
