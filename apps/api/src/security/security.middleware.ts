import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Add security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    // Add Content Security Policy
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' ws: wss:; frame-ancestors 'none';"
    );

    // Sanitize request body to prevent PII leakage
    if (req.body) {
      this.sanitizeRequestBody(req.body);
    }

    // Sanitize response body to prevent UUID leakage
    const originalSend = res.send;
    res.send = function(body: any) {
      if (typeof body === 'string') {
        body = this.sanitizeResponseBody(body);
      } else if (typeof body === 'object') {
        body = this.sanitizeResponseBody(body);
      }
      return originalSend.call(this, body);
    }.bind(this);

    next();
  }

  private sanitizeRequestBody(body: any): void {
    // Remove or hash sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'credit_card'];
    
    for (const field of sensitiveFields) {
      if (body[field]) {
        body[field] = '[REDACTED]';
      }
    }

    // Hash email addresses
    if (body.email) {
      body.email = this.hashEmail(body.email);
    }

    // Hash phone numbers
    if (body.phone) {
      body.phone = this.hashPhone(body.phone);
    }
  }

  private sanitizeResponseBody(body: any): any {
    if (typeof body === 'string') {
      // Remove UUIDs from response strings
      body = body.replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        '[UUID]'
      );
      return body;
    }

    if (typeof body === 'object' && body !== null) {
      if (Array.isArray(body)) {
        return body.map(item => this.sanitizeResponseBody(item));
      } else {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(body)) {
          if (this.shouldSanitizeField(key, value)) {
            sanitized[key] = this.sanitizeValue(key, value);
          } else {
            sanitized[key] = this.sanitizeResponseBody(value);
          }
        }
        return sanitized;
      }
    }

    return body;
  }

  private shouldSanitizeField(key: string, value: any): boolean {
    const sensitiveKeys = [
      'id', 'uuid', 'token', 'secret', 'password', 'email', 'phone',
      'credit_card', 'address', 'name'
    ];

    return sensitiveKeys.some(sensitiveKey => 
      key.toLowerCase().includes(sensitiveKey.toLowerCase())
    );
  }

  private sanitizeValue(key: string, value: any): any {
    if (typeof value === 'string') {
      // Hash UUIDs
      if (this.isUUID(value)) {
        return this.hashUUID(value);
      }
      
      // Hash emails
      if (this.isEmail(value)) {
        return this.hashEmail(value);
      }
      
      // Hash phone numbers
      if (this.isPhone(value)) {
        return this.hashPhone(value);
      }
      
      // Hash names (except for display names)
      if (key.toLowerCase().includes('name') && !key.toLowerCase().includes('display')) {
        return this.hashName(value);
      }
    }

    return value;
  }

  private isUUID(value: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }

  private isEmail(value: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }

  private isPhone(value: string): boolean {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(value.replace(/[\s\-\(\)]/g, ''));
  }

  private hashUUID(uuid: string): string {
    return `uuid_${createHash('sha256').update(uuid).digest('hex').substring(0, 8)}`;
  }

  private hashEmail(email: string): string {
    const [local, domain] = email.split('@');
    const hashedLocal = createHash('sha256').update(local).digest('hex').substring(0, 4);
    return `${hashedLocal}@${domain}`;
  }

  private hashPhone(phone: string): string {
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    return `+${cleaned.substring(0, 2)}***${cleaned.substring(-4)}`;
  }

  private hashName(name: string): string {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}*** ${parts[parts.length - 1]}`;
    }
    return `${name[0]}***`;
  }
} 