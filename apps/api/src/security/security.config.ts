export const SecurityConfig = {
  // Rate limiting configuration
  rateLimiting: {
    // Global rate limits
    global: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100, // limit each IP to 100 requests per windowMs
    },
    
    // Specific endpoint limits
    endpoints: {
      '/api/games': {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 10,
      },
      '/api/games/*/join': {
        windowMs: 60 * 1000,
        maxRequests: 5,
      },
      '/api/games/*/questions/custom': {
        windowMs: 60 * 1000,
        maxRequests: 3,
      },
      '/api/rounds/*/shot': {
        windowMs: 30 * 1000,
        maxRequests: 10,
      },
      '/api/rounds/*/actions': {
        windowMs: 30 * 1000,
        maxRequests: 5,
      },
      '/api/questions/*/flag': {
        windowMs: 60 * 1000,
        maxRequests: 2,
      },
    },
  },

  // CORS configuration
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
  },

  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret-change-in-production',
    expiresIn: '24h',
    refreshExpiresIn: '7d',
    algorithm: 'HS256',
  },

  // Content Security Policy
  csp: {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'https:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", 'ws:', 'wss:'],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
  },

  // Helmet configuration
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  },

  // Input validation
  validation: {
    maxQuestionLength: 500,
    maxPlayerNameLength: 50,
    maxAvatarLength: 10,
    maxGameNameLength: 100,
    minPlayers: 2,
    maxPlayers: 10,
  },

  // Sanitization rules
  sanitization: {
    // Fields to always hash/redact
    sensitiveFields: [
      'password',
      'token',
      'secret',
      'key',
      'credit_card',
      'api_key',
    ],
    
    // Fields to hash in logs
    logSensitiveFields: [
      'gameId',
      'playerId',
      'userId',
      'token',
      'password',
    ],
    
    // UUID patterns to detect and hash
    uuidPatterns: [
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    ],
    
    // Email patterns
    emailPattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    
    // Phone patterns
    phonePattern: /^[\+]?[1-9][\d]{0,15}$/,
  },

  // Game isolation rules
  gameIsolation: {
    // Maximum number of concurrent games per player
    maxConcurrentGames: 3,
    
    // Maximum number of players per game
    maxPlayersPerGame: 10,
    
    // Game timeout (inactive games are cleaned up)
    gameTimeout: 24 * 60 * 60 * 1000, // 24 hours
    
    // Round timeout
    roundTimeout: 5 * 60 * 1000, // 5 minutes
    
    // Question submission timeout
    questionTimeout: 2 * 60 * 1000, // 2 minutes
  },

  // Monitoring and logging
  monitoring: {
    // Security event logging
    logSecurityEvents: true,
    
    // Rate limit violation logging
    logRateLimitViolations: true,
    
    // Failed authentication attempts
    logAuthFailures: true,
    
    // Cross-game access attempts
    logCrossGameAccess: true,
    
    // PII detection logging
    logPIIDetection: true,
  },

  // Error handling
  errors: {
    // Don't expose internal errors in production
    exposeInternalErrors: process.env.NODE_ENV !== 'production',
    
    // Generic error messages for production
    genericErrorMessages: {
      authentication: 'Authentication failed',
      authorization: 'Access denied',
      validation: 'Invalid input',
      notFound: 'Resource not found',
      serverError: 'Internal server error',
    },
  },

  // WebSocket security
  websocket: {
    // Maximum connections per IP
    maxConnectionsPerIP: 10,
    
    // Connection timeout
    connectionTimeout: 30 * 1000, // 30 seconds
    
    // Heartbeat interval
    heartbeatInterval: 25 * 1000, // 25 seconds
    
    // Maximum message size
    maxMessageSize: 2048, // 2KB
    
    // Allowed origins for WebSocket connections
    allowedOrigins: [
      process.env.FRONTEND_URL || 'http://localhost:5173',
    ],
  },

  // Database security
  database: {
    // Use parameterized queries only
    useParameterizedQueries: true,
    
    // Maximum query execution time
    maxQueryTime: 5000, // 5 seconds
    
    // Log slow queries
    logSlowQueries: true,
    
    // Connection pool settings
    connectionPool: {
      min: 2,
      max: 10,
      acquireTimeoutMillis: 30000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200,
    },
  },

  // Redis security
  redis: {
    // Use TLS in production
    useTLS: process.env.NODE_ENV === 'production',
    
    // Connection timeout
    connectTimeout: 10000,
    
    // Command timeout
    commandTimeout: 5000,
    
    // Retry strategy
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  },
}; 