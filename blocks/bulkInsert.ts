import { AppBlock, events } from "@slflows/sdk/v1";
import { getPool } from "../utils/pool.ts";

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
        const pool = await getPool(input.app.config);

        const client = await pool.connect();
        try {
          // Build the INSERT query with multiple value sets using parameterized queries
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

          // Create placeholder sets for each row
          const valuePlaceholders: string[] = [];
          const flatValues: any[] = [];
          let paramIndex = 1;

          for (const row of rowsData) {
            const rowPlaceholders: string[] = [];
            for (const value of row) {
              rowPlaceholders.push(`$${paramIndex}`);
              // Handle BigInt values
              if (typeof value === "bigint") {
                flatValues.push(value.toString());
              } else {
                flatValues.push(value);
              }
              paramIndex++;
            }
            valuePlaceholders.push(`(${rowPlaceholders.join(", ")})`);
          }

          const insertQuery = `INSERT INTO ${table} (${columnsList}) VALUES ${valuePlaceholders.join(", ")}`;

          const result = await client.query(insertQuery, flatValues);

          await events.emit({
            rowCount: result.rowCount || rowsData.length,
            table: table as string,
          });
        } finally {
          client.release();
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
