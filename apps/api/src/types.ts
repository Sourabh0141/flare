import type { AppBindings, AppConfig } from './config/env';
import type { Logger } from './lib/logger';

/** Context variables populated by middleware, available to every handler via `c.get`. */
export interface AppVariables {
  requestId: string;
  logger: Logger;
  config: AppConfig;
  userId: string;
  /** Verified session token claims; used for role checks. */
  claims: Record<string, unknown>;
}

export type AppEnv = {
  Bindings: AppBindings;
  Variables: AppVariables;
};
