import type { AppBindings, AppConfig } from './config/env';
import type { Logger } from './lib/logger';

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
