# PostgreSQL

## Description

App for interacting with PostgreSQL databases. Supports queries, commands, bulk operations, schema introspection, and NOTIFY.

## Configuration

The app requires PostgreSQL connection details:

- `host` - PostgreSQL server hostname or IP address (required)
- `port` - Server port (default: 5432)
- `database` - Database name (default: postgres)
- `username` - PostgreSQL username (default: postgres)
- `password` - PostgreSQL password (optional for trust auth)
- `sslMode` - SSL connection mode: `disable`, `allow`, `prefer`, `require`, `verify-ca`, `verify-full` (default: prefer)
- `connectionTimeout` - Connection timeout in seconds (default: 10)
- `statementTimeout` - Statement timeout in milliseconds (default: 30000, optional)

## Blocks

- `executeQuery`
  - Description: Executes SELECT queries and returns results as an array of row objects

- `executeCommand`
  - Description: Executes INSERT, UPDATE, DELETE, or DDL commands. Returns number of rows affected. or RETURNING clauses, use executeQuery instead.

- `bulkInsert`
  - Description: Efficiently inserts multiple rows using PostgreSQL's COPY protocol for maximum performance

- `sendNotification`
  - Description: Sends a NOTIFY event to a PostgreSQL channel with optional payload (max 8000 bytes)

- `getTableInfo`
  - Description: Retrieves schema information including columns, constraints, and indexes
