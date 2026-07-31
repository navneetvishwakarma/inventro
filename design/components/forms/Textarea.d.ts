export interface TextareaProps {
  label?: string;
  error?: string;
  helperText?: string;
  rows?: number;
  disabled?: boolean;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}
export declare function Textarea(props: TextareaProps): JSX.Element;
