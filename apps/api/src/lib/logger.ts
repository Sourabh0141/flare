type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogFields = Record<string, unknown>;

/**
 * Structured JSON logger. Workers Logs indexes JSON fields, so every line is one object
 * with a stable `event` name plus context. Bound fields (request id, user id) are merged
 * into every entry emitted by a child logger.
 */
export class Logger {
  constructor(private readonly bound: LogFields = {}) {}

  child(fields: LogFields): Logger {
    return new Logger({ ...this.bound, ...fields });
  }

  debug(event: string, fields?: LogFields): void {
    this.emit('debug', event, fields);
  }

  info(event: string, fields?: LogFields): void {
    this.emit('info', event, fields);
  }

  warn(event: string, fields?: LogFields): void {
    this.emit('warn', event, fields);
  }

  error(event: string, fields?: LogFields): void {
    this.emit('error', event, fields);
  }

  private emit(level: LogLevel, event: string, fields?: LogFields): void {
    const entry = { level, event, ts: new Date().toISOString(), ...this.bound, ...fields };
    const line = JSON.stringify(entry, replaceErrors);
    switch (level) {
      case 'error':
        console.error(line);
        break;
      case 'warn':
        console.warn(line);
        break;
      default:
        console.log(line);
    }
  }
}

function replaceErrors(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

export const rootLogger = new Logger({ service: 'flare-api' });
