import { AppBlock, events } from "@slflows/sdk/v1";
import { getPool } from "../utils/pool.ts";

export const getTableInfo: AppBlock = {
  name: "Get Table Info",
  description: "Retrieves schema information about tables and columns",
  category: "Utility",

  inputs: {
    default: {
      config: {
        schema: {
          name: "Schema Name",
          description: "Database schema name",
          type: "string",
          required: false,
        },
        table: {
          name: "Table Name",
          description: "Table name to get information about",
          type: "string",
          required: true,
        },
      },
      async onEvent(input) {
        const { schema: schemaName, table } = input.event.inputConfig;
        const actualSchema = schemaName || "public";

        const pool = await getPool(input.app.config);
        const client = await pool.connect();

        try {
          // Get table information
          const tableQuery = `
            SELECT 
              t.table_schema,
              t.table_name,
              t.table_type,
              obj_description(c.oid) as table_comment
            FROM information_schema.tables t
            LEFT JOIN pg_class c ON c.relname = t.table_name
            LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.table_schema
            WHERE t.table_schema = $1 
              AND t.table_name = $2
          `;

          const tableResult = await client.query(tableQuery, [
            actualSchema,
            table,
          ]);

          if (tableResult.rows.length === 0) {
            throw new Error(`Table ${actualSchema}.${table} not found`);
          }

          const tableInfo = tableResult.rows[0];

          // Get column information
          const columnsQuery = `
            SELECT 
              c.column_name,
              c.data_type,
              c.is_nullable,
              c.column_default,
              c.character_maximum_length,
              c.numeric_precision,
              c.numeric_scale,
              col_description(pgc.oid, c.ordinal_position) as column_comment
            FROM information_schema.columns c
            LEFT JOIN pg_class pgc ON pgc.relname = c.table_name
            LEFT JOIN pg_namespace n ON n.oid = pgc.relnamespace AND n.nspname = c.table_schema
            WHERE c.table_schema = $1 
              AND c.table_name = $2
            ORDER BY c.ordinal_position
          `;

          const columnsResult = await client.query(columnsQuery, [
            actualSchema,
            table,
          ]);

          // Get constraints
          const constraintsQuery = `
            SELECT 
              tc.constraint_name,
              tc.constraint_type,
              string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns,
              ccu.table_schema as foreign_table_schema,
              ccu.table_name as foreign_table_name,
              string_agg(ccu.column_name, ', ') as foreign_columns
            FROM information_schema.table_constraints tc
            LEFT JOIN information_schema.key_column_usage kcu 
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
              AND tc.table_name = kcu.table_name
            LEFT JOIN information_schema.constraint_column_usage ccu
              ON tc.constraint_name = ccu.constraint_name
              AND tc.table_schema = ccu.table_schema
            WHERE tc.table_schema = $1 
              AND tc.table_name = $2
            GROUP BY tc.constraint_name, tc.constraint_type, 
                     ccu.table_schema, ccu.table_name
          `;

          const constraintsResult = await client.query(constraintsQuery, [
            actualSchema,
            table,
          ]);

          // Get indexes
          const indexesQuery = `
            SELECT 
              i.relname as index_name,
              ix.indisunique as is_unique,
              ix.indisprimary as is_primary,
              string_agg(a.attname, ', ' ORDER BY array_position(ix.indkey, a.attnum)) as columns
            FROM pg_index ix
            INNER JOIN pg_class t ON t.oid = ix.indrelid
            INNER JOIN pg_class i ON i.oid = ix.indexrelid
            INNER JOIN pg_namespace n ON n.oid = t.relnamespace
            INNER JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
            WHERE n.nspname = $1
              AND t.relname = $2
            GROUP BY i.relname, ix.indisunique, ix.indisprimary
          `;

          const indexesResult = await client.query(indexesQuery, [
            actualSchema,
            table,
          ]);

          await events.emit({
            schema: tableInfo.table_schema,
            tableName: tableInfo.table_name,
            tableType: tableInfo.table_type,
            tableComment: tableInfo.table_comment,
            columns: columnsResult.rows.map((col) => ({
              name: col.column_name,
              dataType: col.data_type,
              nullable: col.is_nullable === "YES",
              defaultValue: col.column_default,
              maxLength: col.character_maximum_length,
              numericPrecision: col.numeric_precision,
              numericScale: col.numeric_scale,
              comment: col.column_comment,
            })),
            constraints: constraintsResult.rows.map((con) => ({
              name: con.constraint_name,
              type: con.constraint_type,
              columns: con.columns,
              foreignTableSchema: con.foreign_table_schema,
              foreignTableName: con.foreign_table_name,
              foreignColumns: con.foreign_columns,
            })),
            indexes: indexesResult.rows.map((idx) => ({
              name: idx.index_name,
              isUnique: idx.is_unique,
              isPrimary: idx.is_primary,
              columns: idx.columns,
            })),
          });
        } finally {
          client.release();
        }
      },
    },
  },

  outputs: {
    default: {
      name: "Table Information",
      description: "Complete schema information about the table",
      default: true,
      possiblePrimaryParents: ["default"],
      type: {
        type: "object",
        properties: {
          schema: {
            type: "string",
            description: "Schema name",
          },
          tableName: {
            type: "string",
            description: "Table name",
          },
          tableType: {
            type: "string",
            description: "Table type (BASE TABLE, VIEW, etc.)",
          },
          tableComment: {
            type: "string",
            description: "Table comment/description",
          },
          columns: {
            type: "array",
            description: "Array of column definitions",
            items: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "Column name",
                },
                dataType: {
                  type: "string",
                  description: "PostgreSQL data type",
                },
                nullable: {
                  type: "boolean",
                  description: "Whether the column allows NULL values",
                },
                defaultValue: {
                  type: "string",
                  description: "Default value expression",
                },
                maxLength: {
                  type: "number",
                  description: "Maximum character length (for string types)",
                },
                numericPrecision: {
                  type: "number",
                  description: "Numeric precision (for numeric types)",
                },
                numericScale: {
                  type: "number",
                  description: "Numeric scale (for numeric types)",
                },
                comment: {
                  type: "string",
                  description: "Column comment/description",
                },
              },
            },
          },
          constraints: {
            type: "array",
            description: "Array of table constraints",
            items: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "Constraint name",
                },
                type: {
                  type: "string",
                  description:
                    "Constraint type (PRIMARY KEY, FOREIGN KEY, UNIQUE, CHECK)",
                },
                columns: {
                  type: "string",
                  description: "Columns involved in the constraint",
                },
                foreignTableSchema: {
                  type: "string",
                  description: "Referenced table schema (for foreign keys)",
                },
                foreignTableName: {
                  type: "string",
                  description: "Referenced table name (for foreign keys)",
                },
                foreignColumns: {
                  type: "string",
                  description: "Referenced columns (for foreign keys)",
                },
              },
            },
          },
          indexes: {
            type: "array",
            description: "Array of table indexes",
            items: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "Index name",
                },
                isUnique: {
                  type: "boolean",
                  description: "Whether the index enforces uniqueness",
                },
                isPrimary: {
                  type: "boolean",
                  description: "Whether this is the primary key index",
                },
                columns: {
                  type: "string",
                  description: "Columns included in the index",
                },
              },
            },
          },
        },
        required: [
          "schema",
          "tableName",
          "tableType",
          "columns",
          "constraints",
          "indexes",
        ],
      },
    },
  },
};
