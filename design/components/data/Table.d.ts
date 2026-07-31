export interface TableColumn { key: string; header: string; align?: "left" | "right" | "center"; numeric?: boolean; render?: (row: any) => React.ReactNode; }
/**
 * @startingPoint section="Components" subtitle="Web data table with a mobile-collapsed row equivalent" viewport="700x260"
 */
export interface TableProps { columns: TableColumn[]; rows: any[]; keyField?: string; }
export declare function Table(props: TableProps): JSX.Element;
export interface TableRowMobileProps { primary: React.ReactNode; secondary?: React.ReactNode; meta?: React.ReactNode; }
export declare function TableRowMobile(props: TableRowMobileProps): JSX.Element;
