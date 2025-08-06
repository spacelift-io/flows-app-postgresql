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
  - Implementation: Raw API call using parameterized queries ($1, $2, etc.)
  
- `executeCommand`
  - Description: Executes INSERT, UPDATE, DELETE, or DDL commands. Returns number of rows affected.
  - Implementation: Raw API call. For RETURNING clauses, use executeQuery instead.

- `bulkInsert`
  - Description: Efficiently inserts multiple rows using parameterized batch insert
  - Implementation: Builds a single INSERT statement with multiple value sets

- `sendNotification`
  - Description: Sends a NOTIFY event to a PostgreSQL channel with optional payload (max 8000 bytes)
  - Implementation: Uses pg_notify function with parameterized channel name

- `getTableInfo`
  - Description: Retrieves schema information including columns, constraints, and indexes
  - Implementation: Queries information_schema and pg_catalog system tables

## Implementation Notes

- All blocks use parameterized queries to prevent SQL injection
- Connection pooling with max 10 connections per app installation
- BigInt values are automatically converted to strings for JSON compatibility
- Each block gets a client from the pool, executes, then releases
- No cross-block transaction support - each block uses an independent connection

## Security

- All queries use parameterized statements ($1, $2 placeholders)
- SSL/TLS support with configurable verification levels
- Password field marked as sensitive
- Connection validation in onSync with specific error messages

## Limitations

- Transactions cannot span multiple blocks
- NOTIFY payloads limited to 8000 bytes
- BigInt values converted to strings
- Maximum 10 concurrent connections per installation
