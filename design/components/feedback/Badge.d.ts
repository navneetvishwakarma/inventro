/**
 * @startingPoint section="Components" subtitle="Cadence, stock-state, and staple status pills" viewport="700x120"
 */
export interface BadgeProps {
  children?: React.ReactNode;
  tone?: "neutral" | "brand" | "gold" | "success" | "warning" | "error" | "info";
}
export declare function Badge(props: BadgeProps): JSX.Element;
