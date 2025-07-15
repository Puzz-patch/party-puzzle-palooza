# Security Documentation

This document outlines the security measures implemented in Party Puzzle Palooza to prevent PII leakage, cross-game UUID exposure, and other security vulnerabilities.

## Security Overview

Party Puzzle Palooza implements a comprehensive security framework to protect user data and prevent common web application vulnerabilities.

## Security Measures

### 1. Data Sanitization

#### PII Protection
- **Email Addresses**: Hashed in logs and responses (e.g., `abc1@example.com` → `a1b2@example.com`)
- **Phone Numbers**: Partially redacted (e.g., `+1234567890` → `+12***7890`)
- **Names**: Partially redacted (e.g., `John Doe` → `J*** Doe`)
- **Sensitive Fields**: Automatically redacted (`password`, `token`, `secret`, etc.)

#### UUID Protection
- **Game IDs**: Hashed in logs and external responses
- **Player IDs**: Hashed in cross-game contexts
- **Question IDs**: Hashed in responses to prevent enumeration
- **Round IDs**: Hashed in external communications

### 2. Game Isolation

#### Cross-Game Data Protection
- **Strict Access Control**: Players can only access games they belong to
- **Token Validation**: JWT tokens are tied to specific games
- **Data Sanitization**: Game data is filtered based on player permissions
- **Audit Logging**: All cross-game access attempts are logged

#### Implementation
```typescript
// Verify game access before any operation
const access = await gameIsolationService.verifyGameAccess(gameId, playerToken);

// Sanitize game data based on player permissions
const sanitizedData = gameIsolationService.sanitizeGameData(gameData, playerId);
```

### 3. Rate Limiting

#### Endpoint-Specific Limits
- **Game Creation**: 10 requests per minute
- **Player Joining**: 5 joins per minute
- **Question Submission**: 3 questions per minute
- **Shot Taking**: 10 shots per 30 seconds
- **Player Actions**: 5 actions per 30 seconds
- **Question Flagging**: 2 flags per minute

#### Implementation
```typescript
// Rate limiting middleware applied globally
consumer
  .apply(SecurityMiddleware, RateLimitMiddleware)
  .forRoutes({ path: '*', method: RequestMethod.ALL });
```

### 4. Security Headers

#### HTTP Security Headers
- **X-Content-Type-Options**: `nosniff`
- **X-Frame-Options**: `DENY`
- **X-XSS-Protection**: `1; mode=block`
- **Referrer-Policy**: `strict-origin-when-cross-origin`
- **Permissions-Policy**: `geolocation=(), microphone=(), camera=()`

#### Content Security Policy
```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
font-src 'self' data:;
connect-src 'self' ws: wss:;
frame-ancestors 'none';
```

### 5. Authentication & Authorization

#### JWT Implementation
- **Secure Tokens**: JWT tokens with game-specific claims
- **Token Expiration**: 24-hour expiration with refresh capability
- **Secure Storage**: Tokens stored in HTTP-only cookies
- **Token Validation**: Server-side validation on every request

#### Access Control
```typescript
@UseGuards(JwtPlayerGuard)
@Get(':gameId/manifest')
async getGameManifest(
  @Param('gameId') gameId: string,
  @PlayerId() playerId: string,
  @GameId() gameIdFromToken: string
) {
  // Verify player belongs to this game
  if (gameId !== gameIdFromToken) {
    throw new ForbiddenException('Access denied');
  }
}
```

### 6. Input Validation

#### Validation Rules
- **Question Length**: Maximum 500 characters
- **Player Name**: Maximum 50 characters
- **Game Name**: Maximum 100 characters
- **Avatar**: Maximum 10 characters
- **Player Count**: 2-10 players per game

#### Implementation
```typescript
export class CreateCustomQuestionDto {
  @IsString()
  @MaxLength(500)
  @IsNotBlank()
  question: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;
}
```

### 7. WebSocket Security

#### Connection Limits
- **Per-IP Limit**: Maximum 10 concurrent connections
- **Message Size**: Maximum 2KB per message
- **Connection Timeout**: 30-second timeout
- **Heartbeat**: 25-second heartbeat interval

#### Message Validation
```typescript
// Validate WebSocket messages
@SubscribeMessage('message')
async handleMessage(
  @MessageBody() data: GameMessage,
  @ConnectedSocket() client: Socket
) {
  // Validate message size
  if (JSON.stringify(data).length > 2048) {
    throw new Error('Message too large');
  }
  
  // Validate message structure
  await this.validateGameMessage(data, client);
}
```

## Security Testing

### Automated Security Scans

#### OWASP ZAP Integration
```bash
# Run security scan
./scripts/security-scan.sh

# Check for specific vulnerabilities
- PII leakage detection
- UUID exposure testing
- Cross-game data isolation
- Rate limiting validation
- Authentication bypass attempts
```

#### Security Test Coverage
- **PII Detection**: Automated scanning for personal information
- **UUID Leakage**: Pattern matching for exposed UUIDs
- **Cross-Game Access**: Testing data isolation between games
- **Rate Limiting**: Validation of rate limit enforcement
- **Authentication**: Testing of JWT token validation

### Manual Security Testing

#### Penetration Testing Checklist
- [ ] **Authentication Bypass**: Attempt to access resources without valid tokens
- [ ] **Authorization Testing**: Try to access other players' data
- [ ] **Cross-Game Access**: Attempt to access data from different games
- [ ] **Input Validation**: Test with malicious input (XSS, SQL injection)
- [ ] **Rate Limiting**: Attempt to exceed rate limits
- [ ] **WebSocket Security**: Test WebSocket message validation

## Security Monitoring

### Logging & Alerting

#### Security Events
- **Authentication Failures**: Logged with IP and timestamp
- **Rate Limit Violations**: Tracked for potential abuse
- **Cross-Game Access Attempts**: Monitored for data isolation
- **PII Detection**: Alerts when potential PII is detected
- **Failed Authorization**: Logged for security analysis

#### Monitoring Dashboard
```typescript
// Security metrics
const securityMetrics = {
  authFailures: 0,
  rateLimitViolations: 0,
  crossGameAccessAttempts: 0,
  piiDetections: 0,
  suspiciousActivities: 0
};
```

### Incident Response

#### Security Incident Process
1. **Detection**: Automated monitoring detects security events
2. **Analysis**: Security team analyzes the incident
3. **Containment**: Immediate actions to prevent further damage
4. **Eradication**: Remove the root cause
5. **Recovery**: Restore normal operations
6. **Lessons Learned**: Update security measures

## Compliance

### Data Protection

#### GDPR Compliance
- **Data Minimization**: Only collect necessary data
- **Purpose Limitation**: Data used only for game functionality
- **Storage Limitation**: Data deleted after game completion
- **Right to Erasure**: Players can request data deletion

#### Privacy by Design
- **Default Privacy**: Privacy settings enabled by default
- **Data Anonymization**: PII automatically anonymized
- **Access Controls**: Strict access controls on all data
- **Audit Trails**: Complete audit trails for data access

## Security Best Practices

### Development Guidelines

#### Code Security
- **Input Validation**: Validate all user inputs
- **Output Encoding**: Encode all outputs to prevent XSS
- **Parameterized Queries**: Use prepared statements
- **Error Handling**: Don't expose internal errors
- **Secure Defaults**: Use secure default configurations

#### Deployment Security
- **HTTPS Only**: All communications over HTTPS
- **Security Headers**: Implement all security headers
- **Regular Updates**: Keep dependencies updated
- **Access Logging**: Log all access attempts
- **Backup Security**: Secure backup procedures

### Security Checklist

#### Pre-Deployment
- [ ] Security scan completed
- [ ] All vulnerabilities patched
- [ ] Rate limiting configured
- [ ] Security headers implemented
- [ ] Authentication tested
- [ ] Authorization validated
- [ ] Data sanitization verified
- [ ] Logging configured

#### Post-Deployment
- [ ] Monitor security logs
- [ ] Track security metrics
- [ ] Review access patterns
- [ ] Update security measures
- [ ] Conduct security audits
- [ ] Train team on security

## Security Tools

### Automated Tools
- **OWASP ZAP**: Automated security scanning
- **npm audit**: Dependency vulnerability scanning
- **CodeQL**: Static analysis for security vulnerabilities
- **Trivy**: Container security scanning
- **Custom Scripts**: PII and UUID detection

### Manual Tools
- **Burp Suite**: Manual penetration testing
- **OWASP ZAP**: Manual security testing
- **Custom Test Scripts**: Game-specific security testing

## Contact Information

For security issues or questions:
- **Security Team**: security@party-puzzle-palooza.com
- **Bug Bounty**: security@party-puzzle-palooza.com
- **Emergency**: security@party-puzzle-palooza.com

## Security Updates

This document is updated regularly to reflect current security measures and best practices. Last updated: January 2024. 