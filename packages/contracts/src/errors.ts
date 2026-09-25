import { z } from 'zod';

export const API_ERROR_CODES = [
  'bad_request',
  'validation_failed',
  'unauthorized',
  'forbidden',
  'not_found',
  'payload_too_large',
  'unsupported_media_type',
  'rate_limited',
  'quota_exceeded',
  'not_configured',
  'upstream_error',
  'upstream_timeout',
  'no_speech_detected',
  'internal_error',
] as const;

export const apiErrorCodeSchema = z.enum(API_ERROR_CODES);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

/** Wire format for every non-2xx response from the API. */
export const apiErrorBodySchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    requestId: z.string().optional(),
    details: z.unknown().optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;

/** HTTP status conventionally paired with each error code. */
export const API_ERROR_STATUS: Record<ApiErrorCode, number> = {
  bad_request: 400,
  validation_failed: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  payload_too_large: 413,
  unsupported_media_type: 415,
  no_speech_detected: 422,
  rate_limited: 429,
  quota_exceeded: 429,
  not_configured: 500,
  internal_error: 500,
  upstream_error: 502,
  upstream_timeout: 504,
};
