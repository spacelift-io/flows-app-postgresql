import { AppBlock, events } from "@slflows/sdk/v1";
import { Pool } from "pg";
import { getPoolConfig } from "../utils/poolConfig";

export const executeQuery: AppBlock = {
  name: "Execute Query",
  description: "Executes a SELECT query and returns the results",
  category: "Basic",

  inputs: {
    default: {
      config: {
        query: {
          name: "SQL Query",
          description:
            "SQL SELECT query with optional parameter placeholders ($1, $2, etc.)",
          type: "string",
          required: true,
        },
        parameters: {
          name: "Parameters",
          description: "Array of parameter values for the query",
          type: {
            type: "array",
            items: {},
          },
          required: false,
        },
      },
      async onEvent(input) {
        const { query, parameters } = input.event.inputConfig;
        const pool = new Pool(getPoolConfig(input.app.config));

        const client = await pool.connect();
        try {
          const result = await client.query(
            query as string,
            (parameters as any[]) || [],
          );

          // Handle BigInt serialization
          const rows = result.rows.map((row) => {
            const serializedRow: any = {};
            for (const [key, value] of Object.entries(row)) {
              if (typeof value === "bigint") {
                serializedRow[key] = value.toString();
              } else {
                serializedRow[key] = value;
              }
            }
            return serializedRow;
          });

          await events.emit({
            rows,
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
      name: "Query Result",
      description: "The result of the SELECT query",
      default: true,
      possiblePrimaryParents: ["default"],
      type: {
        type: "object",
        properties: {
          rows: {
            type: "array",
            description: "Array of result rows",
            items: {
              type: "object",
            },
          },
        },
        required: ["rows"],
      },
    },
  },
};
