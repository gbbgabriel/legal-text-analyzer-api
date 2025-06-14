import express, { Request, Response } from 'express';
import { config, validateConfig } from './config';
import { logger } from './utils/logger';
import app from './app';
import { analysisWorker } from './workers/AnalysisWorker';

// Validate configuration
validateConfig();

// Metrics server (separate port)
if (config.metrics.enabled) {
  const metricsApp = express();
  
  // Import metrics after all other modules are loaded
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const promClient = require('prom-client');
  
  // Collect default metrics
  promClient.collectDefaultMetrics({
    timeout: 1000,
    register: promClient.register,
  });
  
  metricsApp.get('/metrics', async (_req: Request, res: Response) => {
    res.set('Content-Type', promClient.register.contentType);
    const metrics = await promClient.register.metrics();
    res.end(metrics);
  });
  
  // Function to try starting metrics server with fallback ports
  const startMetricsServer = (port: number, maxRetries = 5): void => {
    const server = metricsApp.listen(port)
      .on('listening', () => {
        logger.info(`Metrics server running on port ${port}`);
      })
      .on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' && maxRetries > 0) {
          logger.warn(`Port ${port} is busy, trying port ${port + 1}`);
          server.close();
          startMetricsServer(port + 1, maxRetries - 1);
        } else if (err.code === 'EADDRINUSE') {
          logger.error(`Unable to start metrics server: all ports from ${config.metrics.port} to ${port} are in use`);
          logger.info('Metrics server disabled due to port conflicts');
        } else {
          logger.error('Failed to start metrics server:', err);
        }
      });
  };
  
  startMetricsServer(config.metrics.port);
}

// Start server with error handling
const server = app.listen(config.port)
  .on('listening', () => {
    logger.info(`Server running on port ${config.port}`);
    logger.info(`Environment: ${config.nodeEnv}`);
    logger.info(`API Documentation: http://localhost:${config.port}/api-docs`);
    
    if (config.metrics.enabled) {
      logger.info(`Metrics will be available on an available port starting from ${config.metrics.port}`);
    }
  })
  .on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`Port ${config.port} is already in use. Please change the PORT environment variable or stop the service using this port.`);
      process.exit(1);
    } else {
      logger.error('Failed to start server:', err);
      process.exit(1);
    }
  });

// Start analysis worker
analysisWorker.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  analysisWorker.stop();
  
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  analysisWorker.stop();
  
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

export default app;