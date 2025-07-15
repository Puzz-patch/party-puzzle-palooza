import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MetricsService } from '../telemetry/metrics.service';

@Injectable()
export class RoundsMonitoringMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Only monitor rounds endpoints
    if (!req.path.startsWith('/rounds/')) {
      return next();
    }

    const startTime = Date.now();
    const method = req.method;
    const path = req.path;

    // Override res.end to capture response time
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any) {
      const duration = Date.now() - startTime;
      const success = res.statusCode < 400;

      // Record metrics
      this.metricsService.recordRoundsRequest(method, path, duration, success);

      // Call original end method
      return originalEnd.call(this, chunk, encoding);
    }.bind({ metricsService: this.metricsService });

    next();
  }
} 