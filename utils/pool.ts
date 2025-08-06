import { Pool, PoolConfig } from "pg";
import crypto from "crypto";

// Global pool instance
let globalPool: Pool | null = null;
let currentConfigHash: string | null = null;
let poolInitializationPromise: Promise<Pool> | null = null;

/**
 * Creates a hash of the configuration to detect changes
 */
function getConfigHash(appConfig: any): string {
  const configForHash = {
    host: appConfig.host,
    port: appConfig.port,
    database: appConfig.database,
    username: appConfig.username,
    password: appConfig.password,
    sslMode: appConfig.sslMode,
    connectionTimeout: appConfig.connectionTimeout,
    statementTimeout: appConfig.statementTimeout,
  };
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(configForHash))
    .digest("hex");
}

/**
 * Creates pool configuration from app config
 */
function createPoolConfig(appConfig: any): PoolConfig {
  // Configure SSL based on sslMode
  let ssl: any = false;
  if (appConfig.sslMode !== "disable") {
    ssl = {
      rejectUnauthorized:
        appConfig.sslMode === "verify-full" ||
        appConfig.sslMode === "verify-ca",
    };
  }

  return {
    host: appConfig.host as string,
    port: appConfig.port as number,
    database: appConfig.database as string,
    user: appConfig.username as string,
    password: appConfig.password as string | undefined,
    ssl: ssl,
    connectionTimeoutMillis: (appConfig.connectionTimeout as number) * 1000,
    statement_timeout: appConfig.statementTimeout as number | undefined,
    max: 10, // Maximum 10 connections as per design
  };
}

/**
 * Gets or creates the global pool instance.
 * This ensures all blocks share the same pool and handles config changes.
 */
export async function getPool(appConfig: any): Promise<Pool> {
  const configHash = getConfigHash(appConfig);

  // If config hasn't changed and we have a pool, return it
  if (globalPool && currentConfigHash === configHash) {
    return globalPool;
  }

  // If initialization is already in progress, wait for it
  if (poolInitializationPromise && currentConfigHash === configHash) {
    return poolInitializationPromise;
  }

  // Start initialization (this prevents multiple simultaneous initializations)
  poolInitializationPromise = (async () => {
    try {
      // Close the old pool if config changed
      if (globalPool && currentConfigHash !== configHash) {
        console.log("PostgreSQL config changed, recreating pool");
        try {
          await globalPool.end();
        } catch (error) {
          console.error("Error closing old pool:", error);
        }
        globalPool = null;
      }

      // Create new pool
      const poolConfig = createPoolConfig(appConfig);
      const newPool = new Pool(poolConfig);

      // Store the new pool and config hash
      globalPool = newPool;
      currentConfigHash = configHash;

      // Set up error handlers
      newPool.on("error", (err) => {
        console.error("Unexpected PostgreSQL pool error:", err);
      });

      return newPool;
    } finally {
      // Clear the initialization promise when done
      poolInitializationPromise = null;
    }
  })();

  return poolInitializationPromise;
}

/**
 * For backwards compatibility - returns pool config without creating a pool
 */
export function getPoolConfig(appConfig: any): PoolConfig {
  return createPoolConfig(appConfig);
}
