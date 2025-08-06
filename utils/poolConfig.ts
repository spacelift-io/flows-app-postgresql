import { PoolConfig } from "pg";

export function getPoolConfig(appConfig: any): PoolConfig {
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
