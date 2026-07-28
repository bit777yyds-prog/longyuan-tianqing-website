export interface QueryResult<Row> {
  rows: Row[];
}

export interface DatabaseClient {
  query<Row = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<Row>>;
}

export interface TransactionalDatabaseClient extends DatabaseClient {
  transaction<T>(callback: (tx: DatabaseClient) => Promise<T>): Promise<T>;
}
