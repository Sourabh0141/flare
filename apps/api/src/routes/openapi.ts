import { Hono } from 'hono';
import { z, type ZodType } from 'zod';
import {
  adminStatusResponseSchema,
  apiErrorBodySchema,
  conversationDetailResponseSchema,
  healthResponseSchema,
  inviteRequestSchema,
  inviteResponseSchema,
  listConversationsQuerySchema,
  listConversationsResponseSchema,
  listInvitesQuerySchema,
  listInvitesResponseSchema,
  respondRequestSchema,
  reviewInviteRequestSchema,
  reviewInviteResponseSchema,
  settingsResponseSchema,
  transcribeResponseSchema,
  turnEventSchema,
  updateConversationRequestSchema,
  updateConversationResponseSchema,
  updateSettingsRequestSchema,
} from '@flare/contracts';
import type { AppEnv } from '../types';

/**
 * OpenAPI 3.1 document generated from the shared Zod contracts, so the specification can
 * never drift from what the Worker validates and the client parses.
 */

const schema = (type: ZodType) => z.toJSONSchema(type, { target: 'openapi-3.0', io: 'output' });
const inputSchema = (type: ZodType) => z.toJSONSchema(type, { target: 'openapi-3.0', io: 'input' });

const json = (type: ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema: schema(type) } },
});

const errorResponses = {
  '400': json(apiErrorBodySchema, 'Validation failed'),
  '401': json(apiErrorBodySchema, 'Missing or invalid session token'),
  '429': json(apiErrorBodySchema, 'Rate limited or daily quota reached'),
  '5xx': json(apiErrorBodySchema, 'Provider or server failure'),
};

function queryParameters(type: ZodType) {
  const object = inputSchema(type) as {
    properties?: Record<string, unknown>;
    required?: string[];
  };
  return Object.entries(object.properties ?? {}).map(([name, propertySchema]) => ({
    name,
    in: 'query',
    required: object.required?.includes(name) ?? false,
    schema: propertySchema,
  }));
}

export function buildOpenApiDocument(version: string, serverUrl: string) {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Flare API',
      version,
      description:
        'The Worker behind Flare, a voice companion with a face. A turn is three requests: transcribe, respond (a server-sent event stream with per-sentence audio), and, for replays, message audio. All protected routes take a Clerk session token as a bearer token.',
    },
    servers: [{ url: serverUrl }],
    components: {
      securitySchemes: {
        clerkSession: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        TurnEvent: schema(turnEventSchema),
      },
    },
    security: [{ clerkSession: [] }],
    paths: {
      '/api/health': {
        get: {
          summary: 'Health',
          security: [],
          responses: { '200': json(healthResponseSchema, 'Service is up') },
        },
      },
      '/api/docs': {
        get: {
          summary: 'This documentation',
          security: [],
          responses: { '200': { description: 'HTML' } },
        },
      },
      '/api/settings': {
        get: {
          summary: 'Your profile and preferences',
          responses: { '200': json(settingsResponseSchema, 'Profile'), ...errorResponses },
        },
        patch: {
          summary: 'Change name, voice or personality',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: inputSchema(updateSettingsRequestSchema) } },
          },
          responses: { '200': json(settingsResponseSchema, 'Updated profile'), ...errorResponses },
        },
        delete: {
          summary: 'Erase every conversation and preference',
          responses: { '204': { description: 'Erased' }, ...errorResponses },
        },
      },
      '/api/conversations': {
        get: {
          summary: 'List conversations, pinned first',
          parameters: queryParameters(listConversationsQuerySchema),
          responses: { '200': json(listConversationsResponseSchema, 'A page'), ...errorResponses },
        },
      },
      '/api/conversations/{id}': {
        get: {
          summary: 'A conversation and its transcript',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': json(conversationDetailResponseSchema, 'Detail'),
            '404': json(apiErrorBodySchema, 'Not found'),
            ...errorResponses,
          },
        },
        patch: {
          summary: 'Rename, pin or archive',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: inputSchema(updateConversationRequestSchema) },
            },
          },
          responses: {
            '200': json(updateConversationResponseSchema, 'Updated'),
            '404': json(apiErrorBodySchema, 'Not found'),
            ...errorResponses,
          },
        },
        delete: {
          summary: 'Delete a conversation',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '204': { description: 'Deleted' },
            '404': json(apiErrorBodySchema, 'Not found'),
            ...errorResponses,
          },
        },
      },
      '/api/turns/transcribe': {
        post: {
          summary: 'Stage 1: transcribe a recording',
          requestBody: {
            required: true,
            content: { 'audio/webm': { schema: { type: 'string', format: 'binary' } } },
            description:
              'Raw audio body. Also accepts audio/ogg, audio/mp4, audio/mpeg, audio/wav, audio/flac.',
          },
          responses: {
            '200': json(transcribeResponseSchema, 'Transcript'),
            '415': json(apiErrorBodySchema, 'Unsupported media type'),
            '422': json(apiErrorBodySchema, 'No speech detected'),
            ...errorResponses,
          },
        },
      },
      '/api/turns/respond': {
        post: {
          summary: 'Stage 2: reply as a server-sent event stream',
          description:
            'Each event is named "turn" and carries a JSON TurnEvent. Order: meta, expression, then any of delta, sentence and audio (base64 MP3 per sentence, in order), then done; or error at any point.',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: inputSchema(respondRequestSchema) } },
          },
          responses: {
            '200': {
              description: 'text/event-stream of TurnEvent',
              content: {
                'text/event-stream': { schema: { $ref: '#/components/schemas/TurnEvent' } },
              },
            },
            ...errorResponses,
          },
        },
      },
      '/api/messages/{id}/audio': {
        get: {
          summary: 'Stage 3: synthesized speech for a reply',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'audio/mpeg stream' },
            '404': json(apiErrorBodySchema, 'Not found'),
            ...errorResponses,
          },
        },
      },
      '/api/voices/{id}/preview': {
        get: {
          summary: 'A fixed sample sentence in a voice',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'audio/mpeg stream' },
            '404': json(apiErrorBodySchema, 'Unknown voice'),
            ...errorResponses,
          },
        },
      },
      '/api/invites': {
        post: {
          summary: 'Request an invitation (public)',
          security: [],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: inputSchema(inviteRequestSchema) } },
          },
          responses: { '202': json(inviteResponseSchema, 'Received'), ...errorResponses },
        },
      },
      '/api/admin/status': {
        get: {
          summary: 'Whether the caller is an administrator',
          responses: { '200': json(adminStatusResponseSchema, 'Status'), ...errorResponses },
        },
      },
      '/api/admin/invites': {
        get: {
          summary: 'Invite requests by status (admin)',
          parameters: queryParameters(listInvitesQuerySchema),
          responses: {
            '200': json(listInvitesResponseSchema, 'Requests'),
            '403': json(apiErrorBodySchema, 'Not an administrator'),
            ...errorResponses,
          },
        },
      },
      '/api/admin/invites/{id}': {
        patch: {
          summary: 'Approve or dismiss a request (admin)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: inputSchema(reviewInviteRequestSchema) } },
          },
          responses: {
            '200': json(reviewInviteResponseSchema, 'Reviewed'),
            '403': json(apiErrorBodySchema, 'Not an administrator'),
            '404': json(apiErrorBodySchema, 'Not found'),
            ...errorResponses,
          },
        },
      },
    },
  };
}

export const openApiRoutes = new Hono<AppEnv>();

openApiRoutes.get('/openapi.json', (c) => {
  const url = new URL(c.req.url);
  return c.json(buildOpenApiDocument(c.env.APP_VERSION?.trim() || 'dev', url.origin));
});

/** Interactive reference rendered by Scalar from the JSON document above. */
openApiRoutes.get('/docs', (c) => {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Flare API reference</title>
</head>
<body>
  <script id="api-reference" data-url="/api/openapi.json" data-configuration='{"theme":"kepler","darkMode":true}'></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;
  return c.html(html, 200, {
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self' https://cdn.jsdelivr.net",
  });
});
