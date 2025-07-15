# OpenTelemetry Monitoring Setup

This document describes the monitoring setup for Party Puzzle Palooza API using OpenTelemetry, Prometheus, Tempo, and Grafana.

## Overview

The monitoring stack includes:
- **OpenTelemetry**: Distributed tracing and metrics collection
- **Prometheus**: Metrics storage and alerting
- **Tempo**: Distributed tracing storage
- **Grafana**: Visualization and dashboards
- **Alertmanager**: Alert routing and notification

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Server    │    │   Prometheus    │    │   Grafana       │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │OpenTelemetry│ │───▶│ │   Metrics   │ │◀───│ │ Dashboards  │ │
│ │   SDK       │ │    │ │   Storage   │ │    │ │             │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │   Traces    │ │───▶│ │    Tempo    │ │◀───│ │   Traces    │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │  Alertmanager   │
                       │                 │
                       │ ┌─────────────┐ │
                       │ │   Alerts    │ │
                       │ │  Routing    │ │
                       │ └─────────────┘ │
                       └─────────────────┘
```

## Key Metrics

### Rounds Endpoint Monitoring
- **Response Time (p95)**: Alert when > 300ms
- **Request Rate**: Requests per second
- **Error Rate**: Percentage of failed requests
- **Request Count**: Total requests by method and path

### Business Metrics
- **Active Games**: Number of active game sessions
- **Active Players**: Number of connected players
- **Question Flags**: Flag rate by reason
- **Custom Questions**: Creation rate by type

## Setup Instructions

### 1. Install Dependencies

```bash
cd apps/api
npm install
```

### 2. Start Monitoring Stack

```bash
./scripts/setup-monitoring.sh
```

### 3. Configure Environment Variables

```bash
# API Server
export TEMPO_ENDPOINT=http://localhost:4318/v1/traces
export PROMETHEUS_PORT=9464

# Optional: Slack/PagerDuty for alerts
export SLACK_WEBHOOK_URL=your_slack_webhook_url
export PAGERDUTY_KEY=your_pagerduty_key
```

### 4. Start API Server

```bash
cd apps/api
npm run start:dev
```

## Access URLs

- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093
- **Tempo**: http://localhost:3200
- **API Metrics**: http://localhost:3001/metrics

## Alerts

### Critical Alerts
- **Rounds Endpoint Down**: Service unavailable
- **Database Connection Issues**: PostgreSQL down
- **Redis Connection Issues**: Redis down

### Warning Alerts
- **Rounds Endpoint Slow**: p95 > 300ms
- **High Error Rate**: > 5% error rate
- **High Question Flag Rate**: > 10 flags/minute
- **High Memory/CPU Usage**: > 90% memory, > 80% CPU

## Dashboards

### API Dashboard
- Response time trends
- Request/error rates
- Active games and players
- Question flag trends
- Custom question creation

### Infrastructure Dashboard
- System resource usage
- Database performance
- Redis performance
- Network metrics

## Custom Metrics

### Adding New Metrics

```typescript
// In your service
constructor(private readonly metricsService: MetricsService) {}

// Record custom metric
this.metricsService.recordCustomMetric('my_metric', 1, { label: 'value' });
```

### Custom Alerts

Add to `monitoring/alerts.yml`:

```yaml
- alert: MyCustomAlert
  expr: my_custom_metric > threshold
  for: 2m
  labels:
    severity: warning
  annotations:
    summary: "Custom alert description"
```

## Troubleshooting

### Common Issues

1. **Metrics not appearing**
   - Check API server logs for OpenTelemetry errors
   - Verify Prometheus can reach the API metrics endpoint
   - Check firewall settings

2. **Traces not appearing**
   - Verify Tempo is running and accessible
   - Check trace exporter configuration
   - Verify network connectivity

3. **Alerts not firing**
   - Check Prometheus targets are up
   - Verify alert rules syntax
   - Check Alertmanager configuration

### Logs

```bash
# View service logs
cd monitoring
docker-compose logs -f [service-name]

# API server logs
cd apps/api
npm run start:dev
```

### Health Checks

```bash
# API health
curl http://localhost:3001/health

# Metrics endpoint
curl http://localhost:3001/metrics

# Prometheus targets
curl http://localhost:9090/api/v1/targets
```

## Performance Considerations

### Resource Usage
- **Prometheus**: ~100MB RAM, 1GB disk per day
- **Tempo**: ~200MB RAM, 2GB disk per day
- **Grafana**: ~50MB RAM
- **Alertmanager**: ~20MB RAM

### Scaling
- Use remote storage for Prometheus (S3, GCS)
- Configure retention policies
- Use federation for multiple Prometheus instances
- Consider Tempo cloud storage for production

## Security

### Best Practices
- Use HTTPS for all external endpoints
- Implement authentication for Grafana
- Restrict network access to monitoring ports
- Use secrets management for API keys
- Regular security updates

### Network Security
```bash
# Restrict access to monitoring ports
iptables -A INPUT -p tcp --dport 3000 -s trusted_ip -j ACCEPT
iptables -A INPUT -p tcp --dport 9090 -s trusted_ip -j ACCEPT
```

## Maintenance

### Regular Tasks
- Monitor disk usage
- Review and tune alert thresholds
- Update dashboards as needed
- Backup Grafana dashboards
- Review and clean old data

### Backup
```bash
# Backup Grafana dashboards
curl -H "Authorization: Bearer $GRAFANA_API_KEY" \
  http://localhost:3000/api/dashboards/db/backup > backup.json

# Backup Prometheus data
docker exec prometheus tar czf - /prometheus > prometheus_backup.tar.gz
``` 