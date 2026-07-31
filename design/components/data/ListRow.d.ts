/**
 * @startingPoint section="Components" subtitle="Item card / row used in Inventory, Plan, Shopping list" viewport="700x120"
 */
export interface ListRowProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode[];
  trailing?: React.ReactNode;
  href?: string;
  onClick?: () => void;
}
export declare function ListRow(props: ListRowProps): JSX.Element;
