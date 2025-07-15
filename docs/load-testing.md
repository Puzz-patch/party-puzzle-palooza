# Load Testing Documentation

This document describes the load testing setup for Party Puzzle Palooza API using k6 to simulate 1,000 concurrent rooms for 10 minutes.

## Test Overview

### Objective
Simulate realistic load with 1,000 concurrent game rooms to validate:
- API performance under high load
- WebSocket connection stability
- Database connection management
- System resource utilization
- Business metrics accuracy

### Test Configuration
- **Duration**: 14 minutes total (2m ramp-up + 10m sustained + 2m ramp-down)
- **Peak Load**: 1,000 concurrent virtual users
- **Test Scenarios**: Room creation, game joining, WebSocket communication, question flagging

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   k6 Load Test  │    │   API Server    │    │   Monitoring    │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ 1000 VUs    │ │───▶│ │   HTTP API  │ │◀───│ │ Prometheus  │ │
│ │             │ │    │ │             │ │    │ │             │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ WebSocket   │ │───▶│ │ WebSocket   │ │◀───│ │   Grafana   │ │
│ │ Connections │ │    │ │   Gateway   │ │    │ │             │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Database      │
                       │   & Redis       │
                       └─────────────────┘
```

## Test Scenarios

### 1. Room Creation (30% of users)
- Create new game rooms
- Set room parameters (type, max players, etc.)
- Validate room creation success

### 2. Game Joining (40% of users)
- Join existing game rooms
- Handle player registration
- Validate join success

### 3. WebSocket Communication (100% of users)
- Establish WebSocket connections
- Send/receive game messages
- Monitor connection stability

### 4. Question Flagging (1% of users)
- Flag inappropriate questions
- Validate moderation workflow

## Performance Thresholds

| Metric | Threshold | Description |
|--------|-----------|-------------|
| HTTP Response Time (p95) | < 300ms | 95% of HTTP requests should complete within 300ms |
| WebSocket Latency (p95) | < 100ms | 95% of WebSocket messages should have latency < 100ms |
| Error Rate | < 5% | Overall error rate should be below 5% |
| Room Creation Success | > 95% | Room creation should succeed > 95% of the time |
| Game Join Success | > 95% | Game joining should succeed > 95% of the time |

## Setup Instructions

### 1. Install k6
```bash
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### 2. Start Monitoring Stack
```bash
./scripts/setup-monitoring.sh
```

### 3. Start API Server
```bash
cd apps/api
npm run start:dev
```

### 4. Run Load Test
```bash
./scripts/run-load-test.sh
```

## Monitoring Setup

### Metrics Collection
- **k6 Metrics**: HTTP requests, WebSocket latency, custom business metrics
- **System Metrics**: CPU, memory, database connections, Redis connections
- **Application Metrics**: OpenTelemetry traces and metrics

### Visualization
- **Grafana**: Real-time dashboards for k6 and system metrics
- **Prometheus**: Long-term metrics storage
- **Tempo**: Distributed tracing analysis

## Expected Results

### Performance Baseline
Based on the application architecture, we expect:

| Component | Expected Performance |
|-----------|---------------------|
| HTTP API | p95 < 200ms for most endpoints |
| WebSocket | p95 < 50ms for message latency |
| Database | < 100 concurrent connections |
| Redis | < 500 concurrent connections |
| CPU Usage | < 80% during peak load |
| Memory Usage | < 2GB for API server |

### Scaling Considerations
- **Database**: Connection pooling should handle 1,000 concurrent users
- **Redis**: Pub/sub should scale to multiple game rooms
- **WebSocket**: Gateway should maintain stable connections
- **API**: Stateless design should scale horizontally

## Analysis Methodology

### 1. Performance Analysis
- **Response Time Distribution**: Analyze p50, p90, p95, p99 percentiles
- **Throughput**: Requests per second at peak load
- **Error Patterns**: Identify failure modes and bottlenecks

### 2. Resource Analysis
- **CPU Usage**: Monitor for bottlenecks and scaling limits
- **Memory Usage**: Check for memory leaks or inefficient usage
- **Database Connections**: Verify connection pool efficiency
- **Network I/O**: Monitor bandwidth and connection limits

### 3. Business Metrics
- **Room Creation Rate**: Success/failure patterns
- **Game Join Rate**: Performance under load
- **WebSocket Stability**: Connection drop rates
- **Question Flagging**: Moderation system performance

## Troubleshooting

### Common Issues

1. **High Response Times**
   - Check database connection pool
   - Verify Redis performance
   - Monitor CPU usage
   - Check for N+1 queries

2. **WebSocket Disconnections**
   - Verify Redis pub/sub performance
   - Check memory usage
   - Monitor network connectivity
   - Review connection limits

3. **Database Connection Issues**
   - Check connection pool configuration
   - Monitor database performance
   - Verify connection limits
   - Check for connection leaks

4. **High Error Rates**
   - Review application logs
   - Check external service dependencies
   - Verify rate limiting configuration
   - Monitor system resources

### Performance Optimization

1. **Database Optimization**
   - Add database indexes
   - Optimize slow queries
   - Implement connection pooling
   - Use read replicas if needed

2. **Redis Optimization**
   - Configure memory limits
   - Implement key expiration
   - Use Redis clustering for scale
   - Monitor pub/sub performance

3. **API Optimization**
   - Implement caching
   - Add response compression
   - Optimize JSON serialization
   - Use async processing

4. **WebSocket Optimization**
   - Implement connection pooling
   - Add heartbeat mechanisms
   - Optimize message serialization
   - Use WebSocket compression

## Results Interpretation

### Success Criteria
- All performance thresholds met
- No critical errors during test
- Stable resource utilization
- Business metrics within expected ranges

### Failure Analysis
- Identify bottleneck components
- Analyze error patterns
- Review resource utilization
- Plan optimization strategies

### Scaling Recommendations
- Horizontal scaling requirements
- Database optimization needs
- Caching strategy improvements
- Infrastructure upgrades

## Continuous Monitoring

### Production Monitoring
- Set up alerts for performance thresholds
- Monitor business metrics
- Track user experience metrics
- Implement automated testing

### Load Testing Schedule
- Weekly performance tests
- Pre-deployment load tests
- Capacity planning tests
- Stress testing for new features

## Conclusion

This load testing setup provides comprehensive validation of the Party Puzzle Palooza API under realistic load conditions. The results will guide optimization efforts and ensure the system can handle production traffic effectively.

Regular load testing should be integrated into the development workflow to maintain performance standards and identify issues early in the development cycle. 