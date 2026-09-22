# Dynamic CRUD API — Star AI

The Dynamic CRUD API provides a flexible, model-less interface for interacting with any database connected to Star AI. It allows for on-the-fly schema manipulation and data operations without the need for pre-defined SQLAlchemy models.

## 🚀 Key Features

- **Model-less Operations**: Interact with any table using reflection; no need to write Python classes for your tables.
- **Dynamic Schema Management**: Create, rename, and alter tables/columns directly via API calls.
- **SQL Injection Protection**: Strict validation for identifiers (table/column names) and types.
- **Multi-Dialect Support**: Intelligent handling of specific database behaviors (e.g., Auto-increment logic for SQLite vs PostgreSQL).

---

## 📑 API Endpoints

### 1. Schema Introspection
- **`GET /api/v1/db/tables`**: Returns a list of all tables in the active database.
- **`GET /api/v1/db/tables/{table_name}/columns`**: Returns detailed metadata (type, nullability, default values) for all columns in a specific table.

### 2. Table Creation
- **`POST /api/v1/db/tables`**: Create a new table.
  - **Payload**: Requires `table_name` and a list of `columns` (name, type, constraints, auto_increment).

### 3. Data Manipulation (CRUD)
- **`POST /api/v1/db/insert`**: Insert a new record.
  - **Payload**: `table_name` and a dictionary of `values`.
- **`PUT /api/v1/db/update`**: Update existing data or modify schema.
  - **Actions**: `row_update`, `rename_table`, `rename_column`, `add_column`.
- **`DELETE /api/v1/db/delete`**: Delete rows or truncate tables.
  - **Actions**: `where` (conditional delete), `truncate`.

---

## 🛠️ Data Types Supported
The API supports standard SQL types including:
- `INTEGER`, `BIGINT`, `FLOAT`, `DECIMAL`
- `VARCHAR`, `TEXT`
- `BOOLEAN`
- `DATE`, `DATETIME`, `TIMESTAMP`
- `JSON`, `BLOB`

---

## 🛡️ Security & Validation
- **Identifier Validation**: All table and column names are checked against `^[A-Za-z_][A-Za-z0-9_]*$`.
- **Type Whitelisting**: Only approved SQL types can be used during creation/alteration.
- **Transaction Safety**: All operations use `db.begin()`/`db.commit()` logic with automatic rollbacks on failure.
- **Authentication**: All routes are protected by the `verify_access_token_dep` dependency.

---

## 📝 Example Usage (Create Table)

```json
{
  "table_name": "inventory_logs",
  "columns": [
    {
      "name": "id",
      "col_type": "INTEGER",
      "constraints": ["PRIMARY KEY"],
      "auto_increment": true
    },
    {
      "name": "item_name",
      "col_type": "VARCHAR(255)",
      "nullable": false
    },
    {
      "name": "quantity",
      "col_type": "INTEGER",
      "nullable": true
    }
  ]
}
```
