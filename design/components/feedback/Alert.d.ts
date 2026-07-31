/**
 * @startingPoint section="Components" subtitle="Inline info/warning/success/error banners" viewport="700x180"
 */
export interface AlertProps {
  tone?: "info" | "warning" | "success" | "error";
  title?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}
export declare function Alert(props: AlertProps): JSX.Element;
