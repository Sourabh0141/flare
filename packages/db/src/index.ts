/**
 * @flare/db: typed repository layer over Cloudflare D1.
 *
 * Every function takes the `D1Database` binding explicitly so the layer stays free of
 * runtime globals and is trivially testable against a real local D1.
 */

export * from './repositories/users';
export * from './repositories/conversations';
export * from './repositories/messages';
export { encodeCursor, decodeCursor, type ConversationCursor } from './cursor';
export { nowSeconds, newId } from './rows';
