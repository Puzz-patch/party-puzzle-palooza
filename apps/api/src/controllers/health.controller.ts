import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { TelemetryService } from '../telemetry/telemetry';

@Controller('health')
export class HealthController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Get()
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'party-puzzle-palooza-api',
      version: process.env.npm_package_version || '1.0.0',
    };
  }

  @Get('metrics')
  getMetrics(@Res() res: Response) {
    const metricsHandler = this.telemetryService.getMetricsEndpoint();
    return metricsHandler(req, res);
  }
} 