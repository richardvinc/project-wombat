type JsonPanelProps = {
  title: string;
  value: unknown;
};

export function JsonPanel({ title, value }: JsonPanelProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      <pre className="mt-3 overflow-x-auto rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
