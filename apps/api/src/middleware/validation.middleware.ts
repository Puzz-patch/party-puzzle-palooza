import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export interface ValidationMiddlewareOptions {
  schema: z.ZodSchema;
  path?: string;
  method?: string;
}

@Injectable()
export class ValidationMiddleware implements NestMiddleware {
  constructor(private readonly options: ValidationMiddlewareOptions) {}

  use(req: Request, res: Response, next: NextFunction): void {
    try {
      // Validate request body
      if (req.body && Object.keys(req.body).length > 0) {
        this.options.schema.parse(req.body);
      }
      
      // Validate query parameters if needed
      if (req.query && Object.keys(req.query).length > 0) {
        // You can add query validation here if needed
      }
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));
        
        throw new BadRequestException({
          message: 'Validation failed',
          errors: validationErrors,
        });
      }
      
      throw error;
    }
  }
}

// Factory function to create validation middleware
export const createValidationMiddleware = (options: ValidationMiddlewareOptions) => {
  return new ValidationMiddleware(options);
};

// Utility function to validate data with error handling
export const validateData = <T>(schema: z.ZodSchema<T>, data: unknown): T => {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationErrors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      }));
      
      throw new BadRequestException({
        message: 'Validation failed',
        errors: validationErrors,
      });
    }
    
    throw error;
  }
};

// Utility function to safely validate data
export const safeValidateData = <T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: z.ZodError } => {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}; 