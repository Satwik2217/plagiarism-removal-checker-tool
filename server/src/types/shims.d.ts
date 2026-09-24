declare module 'sql.js' {
  export interface Statement {
    bind(values?: any[]): boolean;
    step(): boolean;
    getAsObject(): Record<string, any>;
    free(): void;
  }

  export interface Database {
    run(sql: string, params?: any[]): Database;
    exec(sql: string): Array<{ columns: string[]; values: any[][] }>;
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
  }

  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number>) => Database;
  }

  export default function initSqlJs(config?: any): Promise<SqlJsStatic>;
  export type { Database as DatabaseType };
}

declare module 'pdfmake' {
  const PDFDocument: any;
  export default PDFDocument;
}
