export interface InputProps {
  label?: string;
  error?: string;
  helperText?: string;
  size?: "sm" | "md";
  disabled?: boolean;
  type?: string;
  placeholder?: string;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}
export declare function Input(props: InputProps): JSX.Element;
