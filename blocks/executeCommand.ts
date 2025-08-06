import { AppBlock, events } from "@slflows/sdk/v1";
import { getPool } from "../utils/pool.ts";

export const executeCommand: AppBlock = {
  name: "Execute Command",
  description:
    "Executes INSERT, UPDATE, DELETE, or DDL commands (use Execute Query for RETURNING clauses)",
  category: "Basic",

  inputs: {
    default: {
      config: {
        command: {
          name: "SQL Command",
          description:
            "SQL command to execute with optional parameter placeholders ($1, $2, etc.)",
          type: "string",
          required: true,
        },
        parameters: {
          name: "Parameters",
          description: "Array of parameter values for the command",
          type: {
            type: "array",
            items: {},
          },
          required: false,
        },
      },
      async onEvent(input) {
        const { command, parameters } = input.event.inputConfig;
        const pool = await getPool(input.app.config);

        const client = await pool.connect();
        try {
          const result = await client.query(
            command as string,
            (parameters as any[]) || [],
          );

          await events.emit({
            rowsAffected: result.rowCount || 0,
          });
        } finally {
          client.release();
        }
      },
    },
  },

  outputs: {
    default: {
      name: "Command Result",
      description: "The result of the SQL command execution",
      default: true,
      possiblePrimaryParents: ["default"],
      type: {
        type: "object",
        properties: {
          rowsAffected: {
            type: "number",
            description: "Number of rows affected by the command",
          },
        },
        required: ["rowsAffected"],
      },
    },
  },
};
