import type { AppBindings, AppConfig } from './config/env.js';
import type { Logger } from './lib/logger.js';

/** Context variables populated by middleware, available to every handler via `c.get`. */
export interface AppVariables {
  requestId: string;
  logger: Logger;
  config: AppConfig;
  userId: string;
}

export type AppEnv = {
  Bindings: AppBindings;
  Variables: AppVariables;
};
