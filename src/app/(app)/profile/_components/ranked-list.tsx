"use client";

// A reusable ranked multi-select: pick items and order them by preference
// (add / remove / move up-down). Order of `selected` = the ranking.
export function RankedList<T extends string>({
  label,
  hint,
  options,
  selected,
  format,
  onChange,
}: {
  label: string;
  hint: string;
  options: readonly T[];
  selected: T[];
  format: (value: T) => string;
  onChange: (next: T[]) => void;
}) {
  const available = options.filter((o) => !selected.includes(o));

  function add(v: T) {
    if (!selected.includes(v)) onChange([...selected, v]);
  }
  function remove(v: T) {
    onChange(selected.filter((x) => x !== v));
  }
  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= selected.length) return;
    const next = [...selected];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <fieldset className="flex flex-col gap-1 text-sm">
      <span>{label}</span>
      {selected.length === 0 ? (
        <p className="mt-1 text-xs text-gray-500">{hint}</p>
      ) : (
        <ol className="mt-1 flex flex-col gap-2">
          {selected.map((v, i) => (
            <li
              key={v}
              className="flex items-center justify-between rounded border border-gray-200 bg-white px-3 py-1.5 text-sm"
            >
              <span>
                <span className="text-gray-400">{i + 1}.</span> {format(v)}
              </span>
              <span className="flex items-center gap-2 text-gray-500">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${format(v)} up`}
                  className="disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === selected.length - 1}
                  aria-label={`Move ${format(v)} down`}
                  className="disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => remove(v)}
                  className="text-xs hover:text-red-600"
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}
      {available.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {available.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => add(v)}
              className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
            >
              + {format(v)}
            </button>
          ))}
        </div>
      )}
    </fieldset>
  );
}
