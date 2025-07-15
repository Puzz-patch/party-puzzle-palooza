#!/bin/bash

set -e

echo "🔒 Running Simplified Security Tests..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Create results directory
mkdir -p security-scan-results

# Test 1: Check for hardcoded secrets in code
print_status "Testing for hardcoded secrets..."
SECRETS_FOUND=false

# Check for common secret patterns
if grep -r "password.*=.*['\"]" apps/ 2>/dev/null | grep -v "password.*=.*['\"]test" | grep -v "password.*=.*['\"]password"; then
    print_error "Hardcoded passwords found in code"
    SECRETS_FOUND=true
fi

if grep -r "secret.*=.*['\"]" apps/ 2>/dev/null | grep -v "secret.*=.*['\"]test" | grep -v "secret.*=.*['\"]fallback"; then
    print_error "Hardcoded secrets found in code"
    SECRETS_FOUND=true
fi

if grep -r "api_key.*=.*['\"]" apps/ 2>/dev/null; then
    print_error "Hardcoded API keys found in code"
    SECRETS_FOUND=true
fi

if [ "$SECRETS_FOUND" = false ]; then
    print_success "No hardcoded secrets found"
fi

# Test 2: Check for UUID exposure in code
print_status "Testing for UUID exposure patterns..."
UUID_EXPOSURE=false

# Check for UUID patterns in response examples
if grep -r "id.*:.*['\"][0-9a-f]\{8\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{12\}['\"]" apps/ 2>/dev/null; then
    print_warning "UUID patterns found in code (check if these are examples only)"
    UUID_EXPOSURE=true
fi

# Check for direct UUID returns in controllers
if grep -r "return.*id" apps/api/src/ 2>/dev/null | grep -v "hashUUID\|sanitize"; then
    print_warning "Direct ID returns found in controllers"
    UUID_EXPOSURE=true
fi

if [ "$UUID_EXPOSURE" = false ]; then
    print_success "No direct UUID exposure patterns found"
fi

# Test 3: Check for PII patterns
print_status "Testing for PII patterns..."
PII_EXPOSURE=false

# Check for email patterns
if grep -r "email.*:.*['\"][^'\"]*@[^'\"]*\.[^'\"]*['\"]" apps/ 2>/dev/null | grep -v "example\|test"; then
    print_error "Email patterns found in code"
    PII_EXPOSURE=true
fi

# Check for phone patterns
if grep -r "phone.*:.*['\"][0-9-+() ]*['\"]" apps/ 2>/dev/null | grep -v "example\|test"; then
    print_error "Phone patterns found in code"
    PII_EXPOSURE=true
fi

# Check for SSN patterns
if grep -r "ssn\|social.*security" apps/ 2>/dev/null; then
    print_error "SSN patterns found in code"
    PII_EXPOSURE=true
fi

if [ "$PII_EXPOSURE" = false ]; then
    print_success "No PII patterns found"
fi

# Test 4: Check security middleware implementation
print_status "Testing security middleware implementation..."
SECURITY_MIDDLEWARE=false

if grep -r "SecurityMiddleware" apps/api/src/ 2>/dev/null; then
    print_success "Security middleware found"
    SECURITY_MIDDLEWARE=true
else
    print_error "Security middleware not found"
fi

if grep -r "RateLimitMiddleware" apps/api/src/ 2>/dev/null; then
    print_success "Rate limiting middleware found"
    SECURITY_MIDDLEWARE=true
else
    print_error "Rate limiting middleware not found"
fi

if grep -r "SecurityResponseInterceptor" apps/api/src/ 2>/dev/null; then
    print_success "Security response interceptor found"
    SECURITY_MIDDLEWARE=true
else
    print_error "Security response interceptor not found"
fi

# Test 5: Check for game isolation
print_status "Testing game isolation implementation..."
GAME_ISOLATION=false

if grep -r "GameIsolationService" apps/api/src/ 2>/dev/null; then
    print_success "Game isolation service found"
    GAME_ISOLATION=true
else
    print_error "Game isolation service not found"
fi

if grep -r "verifyGameAccess" apps/api/src/ 2>/dev/null; then
    print_success "Game access verification found"
    GAME_ISOLATION=true
else
    print_error "Game access verification not found"
fi

# Test 6: Check for input validation
print_status "Testing input validation..."
INPUT_VALIDATION=false

if grep -r "@IsString\|@IsNumber\|@IsOptional\|@MaxLength\|@MinLength" apps/api/src/ 2>/dev/null; then
    print_success "Input validation decorators found"
    INPUT_VALIDATION=true
else
    print_error "Input validation decorators not found"
fi

# Test 7: Check for CORS configuration
print_status "Testing CORS configuration..."
CORS_CONFIG=false

if grep -r "enableCors\|CORS" apps/api/src/ 2>/dev/null; then
    print_success "CORS configuration found"
    CORS_CONFIG=true
else
    print_error "CORS configuration not found"
fi

# Test 8: Check for JWT implementation
print_status "Testing JWT implementation..."
JWT_IMPLEMENTATION=false

if grep -r "JwtModule\|JwtService\|@nestjs/jwt" apps/api/src/ 2>/dev/null; then
    print_success "JWT implementation found"
    JWT_IMPLEMENTATION=true
else
    print_error "JWT implementation not found"
fi

# Test 9: Check for security headers
print_status "Testing security headers implementation..."
SECURITY_HEADERS=false

if grep -r "X-Content-Type-Options\|X-Frame-Options\|X-XSS-Protection" apps/api/src/ 2>/dev/null; then
    print_success "Security headers found"
    SECURITY_HEADERS=true
else
    print_error "Security headers not found"
fi

# Test 10: Check for sanitization functions
print_status "Testing data sanitization..."
DATA_SANITIZATION=false

if grep -r "sanitize\|hashUUID\|hashEmail\|hashPhone" apps/api/src/ 2>/dev/null; then
    print_success "Data sanitization functions found"
    DATA_SANITIZATION=true
else
    print_error "Data sanitization functions not found"
fi

# Generate security report
print_status "Generating security report..."

cat > security-scan-results/security-report.md << EOF
# Security Test Report

**Test Date:** $(date)
**Test Type:** Static Code Analysis

## Test Results

### 1. Hardcoded Secrets
- **Status:** $(if [ "$SECRETS_FOUND" = false ]; then echo "✅ PASS"; else echo "❌ FAIL"; fi)
- **Details:** $(if [ "$SECRETS_FOUND" = false ]; then echo "No hardcoded secrets found"; else echo "Hardcoded secrets detected"; fi)

### 2. UUID Exposure
- **Status:** $(if [ "$UUID_EXPOSURE" = false ]; then echo "✅ PASS"; else echo "⚠️ WARNING"; fi)
- **Details:** $(if [ "$UUID_EXPOSURE" = false ]; then echo "No direct UUID exposure patterns found"; else echo "UUID patterns found - review for examples only"; fi)

### 3. PII Exposure
- **Status:** $(if [ "$PII_EXPOSURE" = false ]; then echo "✅ PASS"; else echo "❌ FAIL"; fi)
- **Details:** $(if [ "$PII_EXPOSURE" = false ]; then echo "No PII patterns found"; else echo "PII patterns detected"; fi)

### 4. Security Middleware
- **Status:** $(if [ "$SECURITY_MIDDLEWARE" = true ]; then echo "✅ PASS"; else echo "❌ FAIL"; fi)
- **Details:** Security middleware implementation check

### 5. Game Isolation
- **Status:** $(if [ "$GAME_ISOLATION" = true ]; then echo "✅ PASS"; else echo "❌ FAIL"; fi)
- **Details:** Game isolation implementation check

### 6. Input Validation
- **Status:** $(if [ "$INPUT_VALIDATION" = true ]; then echo "✅ PASS"; else echo "❌ FAIL"; fi)
- **Details:** Input validation decorators check

### 7. CORS Configuration
- **Status:** $(if [ "$CORS_CONFIG" = true ]; then echo "✅ PASS"; else echo "❌ FAIL"; fi)
- **Details:** CORS configuration check

### 8. JWT Implementation
- **Status:** $(if [ "$JWT_IMPLEMENTATION" = true ]; then echo "✅ PASS"; else echo "❌ FAIL"; fi)
- **Details:** JWT implementation check

### 9. Security Headers
- **Status:** $(if [ "$SECURITY_HEADERS" = true ]; then echo "✅ PASS"; else echo "❌ FAIL"; fi)
- **Details:** Security headers implementation check

### 10. Data Sanitization
- **Status:** $(if [ "$DATA_SANITIZATION" = true ]; then echo "✅ PASS"; else echo "❌ FAIL"; fi)
- **Details:** Data sanitization functions check

## Security Score

$(($(if [ "$SECRETS_FOUND" = false ]; then echo 1; else echo 0; fi) + $(if [ "$PII_EXPOSURE" = false ]; then echo 1; else echo 0; fi) + $(if [ "$SECURITY_MIDDLEWARE" = true ]; then echo 1; else echo 0; fi) + $(if [ "$GAME_ISOLATION" = true ]; then echo 1; else echo 0; fi) + $(if [ "$INPUT_VALIDATION" = true ]; then echo 1; else echo 0; fi) + $(if [ "$CORS_CONFIG" = true ]; then echo 1; else echo 0; fi) + $(if [ "$JWT_IMPLEMENTATION" = true ]; then echo 1; else echo 0; fi) + $(if [ "$SECURITY_HEADERS" = true ]; then echo 1; else echo 0; fi) + $(if [ "$DATA_SANITIZATION" = true ]; then echo 1; else echo 0; fi)))/10

## Recommendations

1. **Review UUID Patterns**: Check if UUID patterns in code are examples only
2. **Implement Missing Security**: Address any failed security checks
3. **Regular Security Audits**: Run security scans regularly
4. **Security Training**: Ensure team understands security best practices

## Next Steps

1. Run dynamic security testing with OWASP ZAP
2. Perform penetration testing
3. Conduct security code review
4. Implement security monitoring

EOF

print_success "Security report generated: security-scan-results/security-report.md"

# Display summary
echo ""
print_status "Security Test Summary:"
echo "=========================="
echo "Hardcoded Secrets: $(if [ "$SECRETS_FOUND" = false ]; then echo "✅ PASS"; else echo "❌ FAIL"; fi)"
echo "UUID Exposure: $(if [ "$UUID_EXPOSURE" = false ]; then echo "✅ PASS"; else echo "⚠️ WARNING"; fi)"
echo "PII Exposure: $(if [ "$PII_EXPOSURE" = false ]; then echo "✅ PASS"; else echo "❌ FAIL"; fi)"
echo "Security Middleware: $(if [ "$SECURITY_MIDDLEWARE" = true ]; then echo "✅ PASS"; else echo "❌ FAIL"; fi)"
echo "Game Isolation: $(if [ "$GAME_ISOLATION" = true ]; then echo "✅ PASS"; else echo "❌ FAIL"; fi)"
echo "Input Validation: $(if [ "$INPUT_VALIDATION" = true ]; then echo "✅ PASS"; else echo "❌ FAIL"; fi)"
echo "CORS Configuration: $(if [ "$CORS_CONFIG" = true ]; then echo "✅ PASS"; else echo "❌ FAIL"; fi)"
echo "JWT Implementation: $(if [ "$JWT_IMPLEMENTATION" = true ]; then echo "✅ PASS"; else echo "❌ FAIL"; fi)"
echo "Security Headers: $(if [ "$SECURITY_HEADERS" = true ]; then echo "✅ PASS"; else echo "❌ FAIL"; fi)"
echo "Data Sanitization: $(if [ "$DATA_SANITIZATION" = true ]; then echo "✅ PASS"; else echo "❌ FAIL"; fi)"

# Exit with appropriate code
if [ "$SECRETS_FOUND" = true ] || [ "$PII_EXPOSURE" = true ]; then
    print_error "Critical security issues detected!"
    exit 1
else
    print_success "Security tests completed successfully!"
    exit 0
fi 