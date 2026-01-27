export interface TableMeta {
  id: number;
  name: string;
  created_at: string;
}

export interface ColumnMeta {
  id: number;
  table_id: number;
  name: string;
  type: "text" | "integer" | "real" | "boolean";
  position: number;
}

export interface CreateTableRequest {
  name: string;
  columns: Array<{
    name: string;
    type: ColumnMeta["type"];
  }>;
}

export interface CreateRowRequest {
  [key: string]: unknown;
}
