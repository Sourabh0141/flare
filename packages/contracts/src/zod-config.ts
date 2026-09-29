import { z } from 'zod';

/**
 * Zod probes `new Function` to see if it can compile schemas. A strict Content
 * Security Policy reports that call even though Zod catches it and continues.
 * `jitless` skips the probe. It must run before any schema in this package is built.
 */
z.config({ jitless: true });
