import { createParamDecorator, ExecutionContext, BadRequestException } from '@nestjs/common';
import { z } from 'zod';

export const ValidateBody = (schema: z.ZodSchema) => {
  return createParamDecorator((data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const body = request.body;

    try {
      return schema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.issues.map((err: z.ZodIssue) => ({
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
  })();
};

export const ValidateQuery = (schema: z.ZodSchema) => {
  return createParamDecorator((data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const query = request.query;

    try {
      return schema.parse(query);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.issues.map((err: z.ZodIssue) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));
        
        throw new BadRequestException({
          message: 'Query validation failed',
          errors: validationErrors,
        });
      }
      
      throw error;
    }
  })();
};

export const ValidateParams = (schema: z.ZodSchema) => {
  return createParamDecorator((data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const params = request.params;

    try {
      return schema.parse(params);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.issues.map((err: z.ZodIssue) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));
        
        throw new BadRequestException({
          message: 'Parameter validation failed',
          errors: validationErrors,
        });
      }
      
      throw error;
    }
  })();
}; 