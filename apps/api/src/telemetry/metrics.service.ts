import { Injectable } from '@nestjs/common';
import { trace, metrics, SpanStatusCode } from '@opentelemetry/api';

@Injectable()
export class MetricsService {
  private readonly meter = metrics.getMeter('party-puzzle-palooza-api');
  private readonly tracer = trace.getTracer('party-puzzle-palooza-api');

  // Custom metrics
  private readonly roundsRequestDuration: any;
  private readonly roundsRequestCount: any;
  private readonly roundsRequestErrors: any;
  private readonly activeGames: any;
  private readonly activePlayers: any;
  private readonly questionFlags: any;
  private readonly customQuestionsCreated: any;

  constructor() {
    // Initialize metrics
    this.roundsRequestDuration = this.meter.createHistogram('rounds_request_duration_ms', {
      description: 'Duration of rounds API requests in milliseconds',
      unit: 'ms',
      boundaries: [10, 50, 100, 200, 300, 500, 1000, 2000, 5000],
    });

    this.roundsRequestCount = this.meter.createCounter('rounds_request_total', {
      description: 'Total number of rounds API requests',
    });

    this.roundsRequestErrors = this.meter.createCounter('rounds_request_errors_total', {
      description: 'Total number of rounds API request errors',
    });

    this.activeGames = this.meter.createUpDownCounter('active_games_total', {
      description: 'Total number of active games',
    });

    this.activePlayers = this.meter.createUpDownCounter('active_players_total', {
      description: 'Total number of active players',
    });

    this.questionFlags = this.meter.createCounter('question_flags_total', {
      description: 'Total number of question flags',
    });

    this.customQuestionsCreated = this.meter.createCounter('custom_questions_created_total', {
      description: 'Total number of custom questions created',
    });
  }

  // Rounds endpoint monitoring
  recordRoundsRequest(method: string, path: string, duration: number, success: boolean) {
    const attributes = {
      method,
      path,
      success: success.toString(),
    };

    this.roundsRequestDuration.record(duration, attributes);
    this.roundsRequestCount.add(1, attributes);

    if (!success) {
      this.roundsRequestErrors.add(1, attributes);
    }

    // Log slow requests (>300ms)
    if (duration > 300) {
      console.warn(`Slow rounds request detected: ${method} ${path} took ${duration}ms`);
    }
  }

  // Game metrics
  recordActiveGames(count: number) {
    this.activeGames.add(count);
  }

  recordActivePlayers(count: number) {
    this.activePlayers.add(count);
  }

  // Question metrics
  recordQuestionFlag(reason: string) {
    this.questionFlags.add(1, { reason });
  }

  recordCustomQuestionCreated(type: string) {
    this.customQuestionsCreated.add(1, { type });
  }

  // Tracing helpers
  startSpan(name: string, attributes?: Record<string, any>) {
    return this.tracer.startSpan(name, { attributes });
  }

  recordException(span: any, error: Error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
  }

  // Performance monitoring decorator helper
  async measureAsync<T>(
    operation: string,
    fn: () => Promise<T>,
    attributes?: Record<string, any>
  ): Promise<T> {
    const span = this.startSpan(operation, attributes);
    
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      this.recordException(span, error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  measureSync<T>(
    operation: string,
    fn: () => T,
    attributes?: Record<string, any>
  ): T {
    const span = this.startSpan(operation, attributes);
    
    try {
      const result = fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      this.recordException(span, error as Error);
      throw error;
    } finally {
      span.end();
    }
  }
} 