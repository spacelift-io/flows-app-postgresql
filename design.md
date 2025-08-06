# PostgreSQL App Design

## Overview

The PostgreSQL app for Spacelift Flows enables users to interact with PostgreSQL databases through a variety of blocks designed for different database operations. The app provides both simple query execution and advanced features like transactions, bulk operations, and PostgreSQL-specific capabilities like LISTEN/NOTIFY for event-driven workflows.

## 1. App Configuration Parameters

The app configuration will include essential connection parameters with proper security handling:

### Required Parameters

- **host** (string, required)
  - Description: PostgreSQL server hostname or IP address
  - Example: "db.example.com" or "192.168.1.100"

- **port** (number, required)
  - Description: PostgreSQL server port
  - Default: 5432

- **database** (string, required)
  - Description: Name of the database to connect to
  - Default: "postgres"

- **username** (string, required)
  - Description: PostgreSQL username for authentication
  - Default: "postgres"

- **password** (string, required, sensitive: true)
  - Description: PostgreSQL password for authentication
  - Note: Marked as sensitive to ensure secure handling

### Optional Parameters

Default should not be implemented as the field being filled, but rather as a default value in the code, if the config is not provided.

- **sslMode** (string, optional)
  - Description: SSL connection mode
  - Default: "prefer"
  - Options: "disable", "allow", "prefer", "require", "verify-ca", "verify-full"

- **connectionTimeout** (number, optional)
  - Description: Connection timeout in seconds
  - Default: 10

- **statementTimeout** (number, optional)
  - Description: Default statement timeout in milliseconds (0 = no timeout)
  - Default: 30000

### Connection Validation

The app will implement an `onSync` handler that:
1. Tests the database connection using the provided credentials
2. Validates that the user has necessary permissions
3. Returns appropriate status (ready/failed) based on connection test

## 2. Blocks

### Query Blocks

#### 2.1 Execute Query
**Name:** Execute Query  
**Description:** Executes a SELECT query and returns the results

**Input Config Fields:**
- `query` (string, required): SQL SELECT query with optional parameter placeholders ($1, $2, etc.)
- `parameters` (array, optional): Array of parameter values for the query

**Entity Config Fields:** None

**Outputs:**
- `default`: Query results including rows array, rowCount, and fields metadata

---

#### 2.2 Execute Command
**Name:** Execute Command  
**Description:** Executes INSERT, UPDATE, DELETE, or DDL commands

**Input Config Fields:**
- `command` (string, required): SQL command to execute
- `parameters` (array, optional): Array of parameter values

**Entity Config Fields:** None

**Outputs:**
- `default`: Command result including rowCount and optionally returned rows

---

### Bulk Operation Blocks

#### 2.3 Bulk Insert
**Name:** Bulk Insert  
**Description:** Efficiently inserts multiple rows using PostgreSQL's COPY protocol

**Input Config Fields:**
- `table` (string, required): Target table name
- `columns` (array, required): Array of column names
- `rows` (array, required): Array of row data arrays

**Entity Config Fields:** None

**Outputs:**
- `default`: Insert result with total rowCount

---

### PostgreSQL-Specific Blocks

#### 2.4 Send Notification
**Name:** Send Notification  
**Description:** Sends a NOTIFY event to a PostgreSQL channel

**Input Config Fields:**
- `channel` (string, required): Channel name to notify
- `payload` (any, optional): Notification payload (max 8000 bytes); if not a string, it will be serialized to JSON

**Entity Config Fields:** None

**Outputs:**
- `default`: Confirmation that notification was sent

---

### Utility Blocks

#### 2.5 Get Table Info
**Name:** Get Table Info  
**Description:** Retrieves schema information about tables and columns

**Input Config Fields:**
- `schema` (string, required): Schema name (default: "public")
- `table` (string, required): Table name

**Entity Config Fields:** None

**Outputs:**
- `default`: table definition with columns, types, constraints

---

## Security Considerations

1. **SQL Injection Prevention**: All blocks MUST use parameterized queries. User input is never directly concatenated into SQL strings.

2. **Connection Security**: 
   - Support SSL/TLS connections with configurable verification
   - Sensitive configuration fields marked appropriately
   - Connection credentials never logged

## Error Handling

The app follows the established pattern of letting errors bubble up naturally. Specific PostgreSQL error types will be preserved:
- Connection errors
- Authentication failures  
- Query syntax errors
- Constraint violations
- Deadlocks and lock timeouts
- Permission denied errors

## Implementation Notes

1. **Connection Pooling**: Use `pg` library's built-in pooling with a maximum of 10 connections.
2. **Type Handling**: Properly serialize PostgreSQL types (especially BigInt, arrays, JSON)
3. **Cleanup**: Always release connections back to pool, even on errors
