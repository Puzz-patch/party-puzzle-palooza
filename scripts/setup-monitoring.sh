#!/bin/bash

set -e

echo "🔧 Setting up monitoring stack for Party Puzzle Palooza..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    print_error "docker-compose is not installed. Please install it and try again."
    exit 1
fi

# Create monitoring directories
print_status "Creating monitoring directories..."
mkdir -p monitoring/grafana/provisioning/datasources
mkdir -p monitoring/grafana/provisioning/dashboards
mkdir -p monitoring/grafana/dashboards
mkdir -p nginx/ssl

# Create SSL certificates for development (self-signed)
print_status "Creating self-signed SSL certificates for development..."
if [ ! -f nginx/ssl/cert.pem ] || [ ! -f nginx/ssl/key.pem ]; then
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/ssl/key.pem \
        -out nginx/ssl/cert.pem \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
    print_success "SSL certificates created"
else
    print_warning "SSL certificates already exist, skipping creation"
fi

# Create Grafana datasource configuration
print_status "Creating Grafana datasource configuration..."
cat > monitoring/grafana/provisioning/datasources/prometheus.yml << EOF
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
EOF

# Create Grafana dashboard configuration
print_status "Creating Grafana dashboard configuration..."
cat > monitoring/grafana/provisioning/dashboards/dashboards.yml << EOF
apiVersion: 1

providers:
  - name: 'default'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
EOF

# Create basic Grafana dashboard
print_status "Creating basic Grafana dashboard..."
cat > monitoring/grafana/dashboards/party-puzzle-palooza.json << EOF
{
  "dashboard": {
    "id": null,
    "title": "Party Puzzle Palooza",
    "tags": ["party-puzzle-palooza"],
    "style": "dark",
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "API Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}
      },
      {
        "id": 2,
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0}
      },
      {
        "id": 3,
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])",
            "legendFormat": "5xx errors"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 8}
      },
      {
        "id": 4,
        "title": "Active WebSocket Connections",
        "type": "stat",
        "targets": [
          {
            "expr": "websocket_connections_active",
            "legendFormat": "Active connections"
          }
        ],
        "gridPos": {"h": 4, "w": 6, "x": 12, "y": 8}
      },
      {
        "id": 5,
        "title": "Database Connections",
        "type": "stat",
        "targets": [
          {
            "expr": "pg_stat_database_numbackends",
            "legendFormat": "Active connections"
          }
        ],
        "gridPos": {"h": 4, "w": 6, "x": 18, "y": 8}
      }
    ],
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "refresh": "30s"
  }
}
EOF

# Create environment file for production
print_status "Creating production environment file..."
if [ ! -f .env.production ]; then
    cat > .env.production << EOF
# Production Environment Variables
NODE_ENV=production

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/party_puzzle_palooza

# Redis
REDIS_URL=redis://localhost:6379

# JWT (CHANGE THIS IN PRODUCTION!)
JWT_SECRET=your-super-secure-jwt-secret-at-least-32-characters

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# Frontend URL
FRONTEND_URL=https://localhost

# API URL
API_URL=https://localhost

# WebSocket URL
WS_URL=wss://localhost/game

# Monitoring
TEMPO_ENDPOINT=http://localhost:4318/v1/traces
PROMETHEUS_PORT=9464

# Grafana
GRAFANA_ADMIN_PASSWORD=admin

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Slack (optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR_WEBHOOK

# PagerDuty (optional)
PAGERDUTY_KEY=your-pagerduty-key
EOF
    print_warning "Created .env.production - please update with your actual values!"
else
    print_warning ".env.production already exists"
fi

# Start monitoring stack
print_status "Starting monitoring stack..."
docker-compose -f docker-compose.prod.yml up -d prometheus grafana alertmanager tempo

# Wait for services to start
print_status "Waiting for services to start..."
sleep 10

# Check if services are running
print_status "Checking service status..."

if docker ps | grep -q prometheus; then
    print_success "Prometheus is running"
else
    print_error "Prometheus failed to start"
fi

if docker ps | grep -q grafana; then
    print_success "Grafana is running"
else
    print_error "Grafana failed to start"
fi

if docker ps | grep -q alertmanager; then
    print_success "Alertmanager is running"
else
    print_error "Alertmanager failed to start"
fi

if docker ps | grep -q tempo; then
    print_success "Tempo is running"
else
    print_error "Tempo failed to start"
fi

# Print access information
echo ""
print_success "Monitoring stack setup complete!"
echo ""
echo "📊 Access URLs:"
echo "  Grafana:      http://localhost:3000 (admin/admin)"
echo "  Prometheus:   http://localhost:9090"
echo "  Alertmanager: http://localhost:9093"
echo "  Tempo:        http://localhost:3200"
echo ""
echo "🔧 Next steps:"
echo "  1. Update .env.production with your actual values"
echo "  2. Start the application: docker-compose -f docker-compose.prod.yml up -d"
echo "  3. Access the application: https://localhost"
echo "  4. View API docs: https://localhost/docs"
echo ""
echo "📚 Documentation:"
echo "  Local Development: docs/local-development.md"
echo "  Deployment: docs/deployment.md"
echo ""

print_success "Setup complete! 🎉" 