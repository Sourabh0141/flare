/**
 * @flare/db: typed repository layer over Cloudflare D1.
 *
 * Every function takes the `D1Database` binding explicitly so the layer stays free of
 * runtime globals and is trivially testable against a real local D1.
 */

export * from './repositories/users.js';
export * from './repositories/conversations.js';
export * from './repositories/messages.js';
export { encodeCursor, decodeCursor, type ConversationCursor } from './cursor.js';
export { nowSeconds, newId } from './rows.js';
