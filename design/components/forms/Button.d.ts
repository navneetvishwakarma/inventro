import type { ReactNode, MouseEventHandler } from "react";
/**
 * @startingPoint section="Components" subtitle="Primary CTA and every button variant" viewport="700x260"
 */
export interface ButtonProps {
  variant?: "primary" | "secondary" | "tertiary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg" | "icon";
  icon?: ReactNode;
  iconPosition?: "start" | "end";
  loading?: boolean;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: MouseEventHandler<HTMLButtonElement>;
  children?: ReactNode;
}
export declare function Button(props: ButtonProps): JSX.Element;
