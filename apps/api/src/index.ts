import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { initializeDatabase, closeDatabase } from '@party-puzzle-palooza/database';
import cookieParser from 'cookie-parser';
import { TelemetryService } from './telemetry/telemetry';

async function bootstrap() {
  let telemetryService: TelemetryService;

  try {
    console.log('🚀 Starting Party Puzzle Palooza API...');

    // Initialize OpenTelemetry
    telemetryService = new TelemetryService();
    console.log('✅ OpenTelemetry initialized');

    // Initialize database
    const dataSource = await initializeDatabase();
    console.log('✅ Database connected');

    // Create NestJS application
    const app = await NestFactory.create(AppModule);

    // Register cookie-parser middleware
    app.use(cookieParser());

    // Enable CORS
    app.enableCors({
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    });

    // Global validation pipe
    app.useGlobalPipes(new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }));

    // Swagger configuration
    const config = new DocumentBuilder()
      .setTitle('Party Puzzle Palooza API')
      .setDescription('API for the Party Puzzle Palooza game platform')
      .setVersion('1.0.0')
      .addTag('games', 'Game management endpoints')
      .addTag('rounds', 'Game round management')
      .addTag('players', 'Player management')
      .addTag('questions', 'Question management and flagging')
      .addTag('shots', 'Shot system for competitive gameplay')
      .addTag('actions', 'Player actions (roll, force, shield)')
      .addTag('archived-prompts', 'Archived game prompts')
      .addTag('finale', 'Game finale and scoring')
      .addTag('health', 'Health check and monitoring')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addCookieAuth(
        'player_token',
        {
          type: 'apiKey',
          in: 'cookie',
          name: 'player_token',
          description: 'Player authentication token from cookie',
        },
        'cookie-auth',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
        showRequestDuration: true,
      },
      customSiteTitle: 'Party Puzzle Palooza API Documentation',
      customCss: `
        .swagger-ui .topbar { display: none }
        .swagger-ui .info .title { color: #6366f1 }
        .swagger-ui .scheme-container { background: #f8fafc }
      `,
    });

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        database: dataSource?.isInitialized ? 'connected' : 'disconnected',
        telemetry: 'enabled',
        swagger: '/docs'
      });
    });

    // Metrics endpoint
    app.get('/metrics', (req, res) => {
      const metricsHandler = telemetryService.getMetricsEndpoint();
      return metricsHandler(req, res);
    });

    // API routes
    app.get('/api/hello', (req, res) => {
      res.json({ message: 'Hello from Party Puzzle Palooza API!' });
    });

    // Gateway status endpoint
    app.get('/api/gateway/status', (req, res) => {
      const gameGateway = app.get('GameGateway');
      res.json({
        redis: gameGateway.getRedisStatus(),
        rooms: gameGateway.getGameRoomStats(),
      });
    });

    const port = process.env.PORT || 3001;
    await app.listen(port);
    
    console.log(`🚀 API server running on port ${port}`);
    console.log(`🔌 WebSocket Gateway available at ws://localhost:${port}/game`);
    console.log(`📊 Gateway status: http://localhost:${port}/api/gateway/status`);
    console.log(`📈 Metrics available at http://localhost:${port}/metrics`);
    console.log(`📚 API Documentation: http://localhost:${port}/docs`);

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('🔄 Shutting down gracefully...');
      await closeDatabase();
      await telemetryService.shutdown();
      await app.close();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('🔄 Shutting down gracefully...');
      await closeDatabase();
      await telemetryService.shutdown();
      await app.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    if (telemetryService) {
      await telemetryService.shutdown();
    }
    process.exit(1);
  }
}

bootstrap(); 