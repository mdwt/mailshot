import { Logger } from "@aws-lambda-powertools/logger";

/**
 * Creates a Logger instance scoped to a service name.
 * LOG_LEVEL is controlled via environment variable (default: INFO).
 * Set LOG_LEVEL=DEBUG for verbose tracing.
 */
export function createLogger(serviceName: string): Logger {
  return new Logger({ serviceName });
}
