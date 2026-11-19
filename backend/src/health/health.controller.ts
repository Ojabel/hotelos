import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../database/prisma.service';
import { Public } from '../auth/auth.decorators';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Application liveness' })
  @ApiOkResponse({ description: 'Application process is responding.' })
  liveness() { return { status: 'ok' as const }; }

  @Get('database')
  @Public()
  @ApiOperation({ summary: 'Database readiness' })
  @ApiOkResponse({ description: 'Database query succeeded.' })
  @ApiServiceUnavailableResponse({ description: 'Database is unavailable.' })
  async database() {
    try {
      await this.prisma.isHealthy();
      return { status: 'ok' as const };
    } catch {
      throw new ServiceUnavailableException({ status: 'unavailable' });
    }
  }
}
