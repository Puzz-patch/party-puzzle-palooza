import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { MeterProvider } from '@opentelemetry/sdk-metrics';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';

export class TelemetryService {
  private sdk: NodeSDK;
  private prometheusExporter: PrometheusExporter;

  constructor() {
    this.initializeTelemetry();
  }

  private initializeTelemetry() {
    // Create Prometheus exporter
    this.prometheusExporter = new PrometheusExporter({
      port: parseInt(process.env.PROMETHEUS_PORT || '9464'),
      endpoint: '/metrics',
    });

    // Create meter provider
    const meterProvider = new MeterProvider();
    meterProvider.addMetricReader(this.prometheusExporter);

    // Create trace exporter for Tempo
    const traceExporter = new OTLPTraceExporter({
      url: process.env.TEMPO_ENDPOINT || 'http://localhost:4318/v1/traces',
      headers: {},
    });

    // Create resource
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'party-puzzle-palooza-api',
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
    });

    // Create SDK
    this.sdk = new NodeSDK({
      resource,
      traceExporter,
      spanProcessor: new BatchSpanProcessor(traceExporter),
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': {
            enabled: false,
          },
        }),
      ],
    });

    // Register instrumentations
    registerInstrumentations({
      instrumentations: [
        new HttpInstrumentation({
          ignoreIncomingPaths: ['/health', '/metrics'],
        }),
        new ExpressInstrumentation(),
        new NestInstrumentation(),
      ],
    });

    // Initialize SDK
    this.sdk.start();
  }

  public getMetricsEndpoint() {
    return this.prometheusExporter.getMetricsRequestHandler();
  }

  public shutdown() {
    return this.sdk.shutdown();
  }
} 