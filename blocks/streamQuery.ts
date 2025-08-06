import { AppBlock, events, kv } from "@slflows/sdk/v1";
import { getPool } from "../utils/pool.ts";

export const streamQuery: AppBlock = {
  name: "Stream Query",
  description:
    "Executes a query and streams results in batches as separate events for large datasets",
  category: "Bulk Operations",

  config: {
    maintainCursor: {
      name: "Maintain Cursor",
      description:
        "Keep cursor open between invocations (useful for incremental processing)",
      type: "boolean",
      required: false,
    },
  },

  inputs: {
    default: {
      config: {
        query: {
          name: "SQL Query",
          description: "SQL query to execute and stream results",
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
        batchSize: {
          name: "Batch Size",
          description: "Number of rows per batch event",
          type: "number",
          required: false,
        },
      },
      async onEvent(input) {
        const {
          query,
          parameters,
          batchSize: configBatchSize,
        } = input.event.inputConfig;
        const maintainCursor =
          (input.block.config.maintainCursor as boolean) || false;
        const batchSize = (configBatchSize as number) || 100;

        const pool = await getPool(input.app.config);
        const client = await pool.connect();

        try {
          // Generate a cursor name for this query
          const cursorName = maintainCursor
            ? `cursor_${input.block.id}`
            : `cursor_${Date.now()}`;

          // If maintaining cursor, check if we have an active cursor
          if (maintainCursor) {
            const cursorState = await kv.block.get("cursorState");
            if (cursorState?.value?.active) {
              // Close previous cursor if exists
              try {
                await client.query(`CLOSE ${cursorState.value.cursorName}`);
              } catch (e) {
                // Cursor might not exist anymore, ignore error
              }
            }
          }

          // Start a transaction and create cursor
          await client.query("BEGIN");
          await client.query(
            `DECLARE ${cursorName} CURSOR FOR ${query}`,
            (parameters as any[]) || [],
          );

          let totalRows = 0;
          let batchNumber = 0;
          let hasMore = true;

          while (hasMore) {
            const fetchResult = await client.query(
              `FETCH ${batchSize} FROM ${cursorName}`,
            );

            if (fetchResult.rows.length > 0) {
              batchNumber++;

              // Handle BigInt serialization
              const rows = fetchResult.rows.map((row) => {
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

              totalRows += rows.length;

              await events.emit(
                {
                  batchNumber,
                  rows,
                  rowCount: rows.length,
                  hasMore: fetchResult.rows.length === batchSize,
                },
                { outputKey: "batch" },
              );

              hasMore = fetchResult.rows.length === batchSize;
            } else {
              hasMore = false;
            }
          }

          if (maintainCursor) {
            // Store cursor state
            await kv.block.set({
              key: "cursorState",
              value: {
                active: true,
                cursorName,
                query,
                parameters,
              },
            });
            // Don't close cursor or commit transaction
          } else {
            // Close cursor and commit transaction
            await client.query(`CLOSE ${cursorName}`);
            await client.query("COMMIT");
          }

          // Emit completion event
          await events.emit(
            {
              totalRows,
              totalBatches: batchNumber,
            },
            { outputKey: "complete" },
          );
        } catch (error) {
          // Rollback transaction on error
          await client.query("ROLLBACK").catch(() => {});
          throw error;
        } finally {
          client.release();
        }
      },
    },
    closeCursor: {
      name: "Close Cursor",
      description:
        "Manually close an open cursor (only used when maintainCursor is true)",
      async onEvent(input) {
        const maintainCursor =
          (input.block.config.maintainCursor as boolean) || false;

        if (!maintainCursor) {
          await events.emit(
            {
              message: "No cursor to close (maintainCursor is false)",
            },
            { outputKey: "complete" },
          );
          return;
        }

        const cursorState = await kv.block.get("cursorState");
        if (!cursorState?.value?.active) {
          await events.emit(
            {
              message: "No active cursor found",
            },
            { outputKey: "complete" },
          );
          return;
        }

        const pool = await getPool(input.app.config);
        const client = await pool.connect();

        try {
          await client.query(`CLOSE ${cursorState.value.cursorName}`);
          await client.query("COMMIT");

          await kv.block.delete(["cursorState"]);

          await events.emit(
            {
              message: "Cursor closed successfully",
            },
            { outputKey: "complete" },
          );
        } catch (error) {
          await client.query("ROLLBACK").catch(() => {});
          throw error;
        } finally {
          client.release();
        }
      },
    },
  },

  outputs: {
    batch: {
      name: "Batch",
      description: "Emitted for each batch of rows",
      default: true,
      possiblePrimaryParents: ["default"],
      type: {
        type: "object",
        properties: {
          batchNumber: {
            type: "number",
            description: "Sequential batch number starting from 1",
          },
          rows: {
            type: "array",
            description: "Array of rows in this batch",
            items: {
              type: "object",
            },
          },
          rowCount: {
            type: "number",
            description: "Number of rows in this batch",
          },
          hasMore: {
            type: "boolean",
            description: "Whether more batches are expected",
          },
        },
        required: ["batchNumber", "rows", "rowCount", "hasMore"],
      },
    },
    complete: {
      name: "Complete",
      description: "Emitted when all rows have been streamed",
      possiblePrimaryParents: ["default", "closeCursor"],
      type: {
        type: "object",
        properties: {
          totalRows: {
            type: "number",
            description: "Total number of rows streamed",
          },
          totalBatches: {
            type: "number",
            description: "Total number of batches emitted",
          },
          message: {
            type: "string",
            description: "Optional status message",
          },
        },
      },
    },
  },
};
