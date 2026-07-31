export interface RadioProps {
  checked?: boolean;
  onChange?: () => void;
  label?: string;
  name?: string;
  disabled?: boolean;
  id?: string;
}
export declare function Radio(props: RadioProps): JSX.Element;
