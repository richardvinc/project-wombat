type ActionButtonProps = {
  label: string;
  loadingLabel?: string;
  isLoading?: boolean;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'neutral' | 'success' | 'primary' | 'secondary';
};

const baseClassName =
  'rounded-md border border-slate-300 px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50';

const variantClassNames: Record<
  NonNullable<ActionButtonProps['variant']>,
  string
> = {
  neutral: 'bg-orange-500 text-white',
  success: 'bg-emerald-600 text-white',
  primary: 'bg-blue-600 text-white',
  secondary: 'bg-white text-slate-900',
};

export function ActionButton({
  label,
  loadingLabel,
  isLoading = false,
  onClick,
  disabled = false,
  variant = 'secondary',
}: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${baseClassName} ${variantClassNames[variant]}`}
    >
      {isLoading ? (loadingLabel ?? label) : label}
    </button>
  );
}
