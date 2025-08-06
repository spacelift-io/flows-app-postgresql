import { AppBlock, events } from "@slflows/sdk/v1";
import { getPool } from "../utils/pool.ts";

export const sendNotification: AppBlock = {
  name: "Send Notification",
  description: "Sends a NOTIFY event to a PostgreSQL channel",
  category: "Listen/Notify",

  inputs: {
    default: {
      config: {
        channel: {
          name: "Channel Name",
          description: "PostgreSQL channel name to send notification to",
          type: "string",
          required: true,
        },
        payload: {
          name: "Payload",
          description:
            "Notification payload (max 8000 bytes). Objects will be JSON stringified.",
          type: {},
          required: false,
        },
      },
      async onEvent(input) {
        const { channel, payload } = input.event.inputConfig;
        const pool = await getPool(input.app.config);

        const client = await pool.connect();
        try {
          let payloadString: string = "";

          if (payload !== undefined && payload !== null) {
            if (typeof payload === "string") {
              payloadString = payload;
            } else {
              payloadString = JSON.stringify(payload);
            }

            // Check payload size (PostgreSQL limit is 8000 bytes)
            const payloadBytes = Buffer.byteLength(payloadString, "utf8");
            if (payloadBytes > 8000) {
              throw new Error(
                `Payload size (${payloadBytes} bytes) exceeds PostgreSQL limit of 8000 bytes`,
              );
            }
          }

          // Use parameterized query for channel name safety
          if (payloadString) {
            await client.query(`SELECT pg_notify($1, $2)`, [
              channel as string,
              payloadString,
            ]);
          } else {
            await client.query(`SELECT pg_notify($1, '')`, [channel as string]);
          }

          await events.emit({
            channel: channel as string,
            payload: payload || null,
          });
        } finally {
          client.release();
        }
      },
    },
  },

  outputs: {
    default: {
      name: "Notification Sent",
      description: "Confirmation that the notification was sent",
      default: true,
      possiblePrimaryParents: ["default"],
      type: {
        type: "object",
        properties: {
          channel: {
            type: "string",
            description: "The channel the notification was sent to",
          },
          payload: {
            description: "The payload that was sent",
          },
        },
        required: ["channel"],
      },
    },
  },
};
