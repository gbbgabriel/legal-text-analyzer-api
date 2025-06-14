import winston from 'winston';
import { config } from '../config';

const formats = {
  json: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  simple: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.colorize(),
    winston.format.simple()
  ),
};

export const logger = winston.createLogger({
  level: config.logging.level,
  format: formats[config.logging.format as keyof typeof formats] || formats.json,
  defaultMeta: { service: 'legal-text-analyzer' },
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      silent: process.env.NODE_ENV === 'test', // Silence logs during tests
    }),
  ],
  exitOnError: false,
});

// Add file transport in production
if (config.isProduction) {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Create a stream object with a 'write' function for Morgan
export const stream = {
  write: (message: string): void => {
    logger.info(message.trim());
  },
};