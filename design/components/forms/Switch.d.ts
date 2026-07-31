/**
 * Intentional addition: no toggle/switch pattern exists in the source (only raw checkboxes),
 * but Settings needs a clear on/off control (e.g. digest notifications) distinct from a tick-off checkbox.
 */
export interface SwitchProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
}
export declare function Switch(props: SwitchProps): JSX.Element;
