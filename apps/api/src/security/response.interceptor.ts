import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response } from 'express';

@Injectable()
export class SecurityResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse<Response>();
    
    // Add security headers
    this.addSecurityHeaders(response);
    
    return next.handle().pipe(
      map(data => {
        // Sanitize response data
        return this.sanitizeResponse(data);
      })
    );
  }

  private addSecurityHeaders(response: Response): void {
    // Security headers
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('X-XSS-Protection', '1; mode=block');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    // Content Security Policy
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' ws: wss:; frame-ancestors 'none';"
    );

    // CORS headers (if needed)
    response.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:5173');
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  }

  private sanitizeResponse(data: any): any {
    if (!data) return data;

    // Deep clone to avoid modifying original data
    const sanitized = JSON.parse(JSON.stringify(data));
    
    return this.sanitizeObject(sanitized);
  }

  private sanitizeObject(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      
      for (const [key, value] of Object.entries(obj)) {
        if (this.shouldSanitizeField(key, value)) {
          sanitized[key] = this.sanitizeValue(key, value);
        } else {
          sanitized[key] = this.sanitizeObject(value);
        }
      }
      
      return sanitized;
    }

    return obj;
  }

  private shouldSanitizeField(key: string, value: any): boolean {
    const sensitiveKeys = [
      'id', 'uuid', 'token', 'secret', 'password', 'email', 'phone',
      'credit_card', 'address', 'name', 'playerId', 'gameId'
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
    const crypto = require('crypto');
    return `uuid_${crypto.createHash('sha256').update(uuid).digest('hex').substring(0, 8)}`;
  }

  private hashEmail(email: string): string {
    const crypto = require('crypto');
    const [local, domain] = email.split('@');
    const hashedLocal = crypto.createHash('sha256').update(local).digest('hex').substring(0, 4);
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