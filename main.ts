import { defineApp } from "@slflows/sdk/v1";
import { blocks } from "./blocks/index";
import { Pool } from "pg";

export const app = defineApp({
  name: "PostgreSQL",
  installationInstructions:
    "Connect your PostgreSQL database to Spacelift Flows.\n\nTo install:\n1. Provide your PostgreSQL connection details\n2. Click 'Confirm' to test the connection\n3. Start using the PostgreSQL blocks in your flows",

  blocks,

  config: {
    host: {
      name: "Host",
      description: "PostgreSQL server hostname or IP address",
      type: "string",
      required: true,
    },
    port: {
      name: "Port",
      description: "PostgreSQL server port",
      type: "number",
      required: true,
      default: 5432,
    },
    database: {
      name: "Database",
      description: "Name of the database to connect to",
      type: "string",
      required: true,
      default: "postgres",
    },
    username: {
      name: "Username",
      description: "PostgreSQL username for authentication",
      type: "string",
      required: true,
      default: "postgres",
    },
    password: {
      name: "Password",
      description:
        "PostgreSQL password for authentication (optional if using trust auth)",
      type: "string",
      required: false,
      sensitive: true,
    },
    sslMode: {
      name: "SSL Mode",
      description: "SSL connection mode",
      type: {
        type: "string",
        enum: [
          "disable",
          "allow",
          "prefer",
          "require",
          "verify-ca",
          "verify-full",
        ],
      },
      required: true,
      default: "prefer",
    },
    connectionTimeout: {
      name: "Connection Timeout",
      description: "Connection timeout in seconds",
      type: "number",
      required: true,
      default: 10,
    },
    statementTimeout: {
      name: "Statement Timeout",
      description:
        "Default statement timeout in milliseconds (leave empty for no timeout)",
      type: "number",
      required: false,
      default: 30000,
    },
  },

  async onSync(input) {
    const config = input.app.config;

    // Configure SSL based on sslMode
    let ssl: any = false;
    if (config.sslMode !== "disable") {
      ssl = {
        rejectUnauthorized:
          config.sslMode === "verify-full" || config.sslMode === "verify-ca",
      };
    }

    // Create a test pool
    const pool = new Pool({
      host: config.host as string,
      port: config.port as number,
      database: config.database as string,
      user: config.username as string,
      password: config.password as string | undefined,
      ssl: ssl,
      connectionTimeoutMillis: (config.connectionTimeout as number) * 1000,
      statement_timeout: config.statementTimeout as number | undefined,
      max: 1, // Just one connection for testing
    });

    try {
      // Test the connection
      const client = await pool.connect();

      // Verify we can execute a simple query
      await client.query("SELECT 1");

      // Check user permissions (basic check)
      const permissionCheck = await client.query(
        `
        SELECT has_database_privilege($1, $2, 'CONNECT') as can_connect
      `,
        [config.username, config.database],
      );

      if (!permissionCheck.rows[0].can_connect) {
        await client.release();
        await pool.end();
        return {
          newStatus: "failed" as const,
          customStatusDescription: "Insufficient database permissions",
        };
      }

      await client.release();
      await pool.end();

      return {
        newStatus: "ready" as const,
      };
    } catch (error: any) {
      await pool.end().catch(() => {}); // Ensure pool is closed

      console.error("PostgreSQL connection test failed:", error.message);

      // Provide specific error messages for common issues
      let statusDescription = "Connection failed";
      if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
        statusDescription = "Cannot reach database server";
      } else if (error.code === "28P01" || error.code === "28000") {
        statusDescription = "Authentication failed";
      } else if (error.code === "3D000") {
        statusDescription = "Database does not exist";
      }

      return {
        newStatus: "failed" as const,
        customStatusDescription: statusDescription,
      };
    }
  },
});
