export interface CheckboxProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
}
export declare function Checkbox(props: CheckboxProps): JSX.Element;
