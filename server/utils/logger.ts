/**
 * @file Shared Logger Configuration
 * @description Centralized logger setup for all services
 */

import winston from 'winston';

export const createLogger = (service: string) => {
  return winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    defaultMeta: { service },
    transports: [
      new winston.transports.Console()
    ],
  });
};

export default createLogger;