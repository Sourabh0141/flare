import { zValidator } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
import type { ZodType } from 'zod';
import { ApiError } from '../lib/errors';

/**
 * `zValidator` with the project's error shape: invalid input becomes a `validation_failed`
 * ApiError carrying the flattened issues, instead of the validator's default body.
 */
export function validate<T extends ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T
) {
  return zValidator(target, schema, (result) => {
    if (!result.success) {
      throw new ApiError('validation_failed', `Invalid request ${target}.`, {
        details: result.error.issues.map((issue) => ({
          path: issue.path.map(String).join('.'),
          message: issue.message,
        })),
      });
    }
  });
}
