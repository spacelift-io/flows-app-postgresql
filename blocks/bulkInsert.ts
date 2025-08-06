import { AppBlock, events } from "@slflows/sdk/v1";
import { Pool } from "pg";
import { getPoolConfig } from "../utils/poolConfig";
import { from as copyFrom } from "pg-copy-streams";

export const bulkInsert: AppBlock = {
  name: "Bulk Insert",
  description:
    "Efficiently inserts multiple rows using PostgreSQL's COPY protocol",
  category: "Bulk Operations",

  inputs: {
    default: {
      config: {
        table: {
          name: "Table Name",
          description:
            "Target table name (optionally with schema, e.g., 'public.users')",
          type: "string",
          required: true,
        },
        columns: {
          name: "Column Names",
          description: "Array of column names to insert into",
          type: {
            type: "array",
            items: {
              type: "string",
            },
          },
          required: true,
        },
        rows: {
          name: "Rows Data",
          description:
            "Array of row data arrays (each inner array must match columns order)",
          type: {
            type: "array",
            items: {
              type: "array",
              items: {},
            },
          },
          required: true,
        },
      },
      async onEvent(input) {
        const { table, columns, rows } = input.event.inputConfig;
        const pool = new Pool(getPoolConfig(input.app.config));

        const client = await pool.connect();
        try {
          const columnsList = (columns as string[])
            .map((col) => `"${col}"`)
            .join(", ");
          const rowsData = rows as any[][];

          if (rowsData.length === 0) {
            await events.emit({
              rowCount: 0,
              table: table as string,
            });
            return;
          }

          // Use COPY protocol for efficient bulk insert
          const copyQuery = `COPY ${table} (${columnsList}) FROM STDIN WITH (FORMAT csv, NULL '\\N')`;
          const stream = copyFrom(copyQuery);

          // Execute COPY query with stream
          client.query(stream as any);

          let rowCount = 0;

          // Process and write all rows directly to the stream
          for (const row of rowsData) {
            const csvRow = row
              .map((value) => {
                if (value === null || value === undefined) {
                  return "\\N";
                }
                if (typeof value === "string") {
                  // Escape quotes and wrap in quotes if needed
                  if (
                    value.includes(",") ||
                    value.includes('"') ||
                    value.includes("\n") ||
                    value.includes("\r")
                  ) {
                    return `"${value.replace(/"/g, '""')}"`;
                  }
                  return value;
                }
                if (typeof value === "bigint") {
                  return value.toString();
                }
                if (typeof value === "boolean") {
                  return value ? "t" : "f";
                }
                if (value instanceof Date) {
                  return value.toISOString();
                }
                if (typeof value === "object") {
                  // For JSON/JSONB columns
                  return JSON.stringify(value);
                }
                return String(value);
              })
              .join(",");

            stream.write(csvRow + "\n");
            rowCount++;
          }

          // Wait for the COPY operation to complete
          await new Promise<void>((resolve, reject) => {
            stream.on("finish", resolve);
            stream.on("error", reject);
            stream.end();
          });

          await events.emit({
            rowCount,
            table: table as string,
          });
        } finally {
          client.release();
          await pool.end();
        }
      },
    },
  },

  outputs: {
    default: {
      name: "Insert Result",
      description: "The result of the bulk insert operation",
      default: true,
      possiblePrimaryParents: ["default"],
      type: {
        type: "object",
        properties: {
          rowCount: {
            type: "number",
            description: "Number of rows inserted",
          },
          table: {
            type: "string",
            description: "The table name where rows were inserted",
          },
        },
        required: ["rowCount", "table"],
      },
    },
  },
};
