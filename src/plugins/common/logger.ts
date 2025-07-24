/**
 * Common Plugin Logger - Shared logging utilities
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Simple logger for plugins with context support
 */
export class PluginLogger {
  private context: string;
  private level: LogLevel;
  private static globalLevel: LogLevel = 'info';

  constructor(context: string, level?: LogLevel) {
    this.context = context;
    this.level = level || PluginLogger.globalLevel;
  }

  static setGlobalLevel(level: LogLevel): void {
    PluginLogger.globalLevel = level;
  }

  debug(message: string, ...args: any[]): void {
    this.log('debug', message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.log('info', message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.log('warn', message, ...args);
  }

  error(message: string, ...args: any[]): void {
    this.log('error', message, ...args);
  }

  createChild(context: string): PluginLogger {
    return new PluginLogger(`${this.context}:${context}`, this.level);
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  private log(level: LogLevel, message: string, ...args: any[]): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${this.context}]`;
    
    switch (level) {
      case 'debug':
        console.debug(prefix, message, ...args);
        break;
      case 'info':
        console.info(prefix, message, ...args);
        break;
      case 'warn':
        console.warn(prefix, message, ...args);
        break;
      case 'error':
        console.error(prefix, message, ...args);
        break;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };

    return levels[level] >= levels[this.level];
  }
}

/**
 * Performance timer utility
 */
export class PerformanceTimer {
  private startTime: number;
  private label: string;
  private logger: PluginLogger;

  constructor(label: string, logger: PluginLogger) {
    this.label = label;
    this.logger = logger;
    this.startTime = Date.now();
    this.logger.debug(`Started: ${this.label}`);
  }

  end(): number {
    const duration = Date.now() - this.startTime;
    this.logger.debug(`Completed: ${this.label} (${duration}ms)`);
    return duration;
  }

  static time<T>(label: string, logger: PluginLogger, fn: () => T): T;
  static time<T>(label: string, logger: PluginLogger, fn: () => Promise<T>): Promise<T>;
  static time<T>(label: string, logger: PluginLogger, fn: () => T | Promise<T>): T | Promise<T> {
    const timer = new PerformanceTimer(label, logger);
    
    try {
      const result = fn();
      
      if (result instanceof Promise) {
        return result.finally(() => timer.end());
      } else {
        timer.end();
        return result;
      }
    } catch (error) {
      timer.end();
      throw error;
    }
  }
}
