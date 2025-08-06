/**
 * Block Registry for PostgreSQL App
 *
 * This file exports all blocks as a dictionary for easy registration.
 */

import { executeQuery } from "./executeQuery";
import { executeCommand } from "./executeCommand";
import { bulkInsert } from "./bulkInsert";
import { streamQuery } from "./streamQuery";
import { sendNotification } from "./sendNotification";
import { getTableInfo } from "./getTableInfo";

/**
 * Dictionary of all available blocks
 */
export const blocks = {
  executeQuery,
  executeCommand,
  bulkInsert,
  streamQuery,
  sendNotification,
  getTableInfo,
} as const;

// Named exports for individual blocks
export {
  executeQuery,
  executeCommand,
  bulkInsert,
  streamQuery,
  sendNotification,
  getTableInfo,
};
