import { useEffect, useRef } from "react";

/** Uncontrolled contenteditable that reports HTML changes without re-rendering the caret away. */
export function Editable({
  html,
  onChange,
  className,
  placeholder,
  editable = true,
  as: Tag = "div",
}: {
  html: string;
  onChange?: (html: string) => void;
  className?: string;
  placeholder?: string;
  editable?: boolean;
  as?: "div" | "span";
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== html) el.innerHTML = html;
  }, [html]);
  return (
    <Tag
      ref={ref as never}
      className={className}
      data-placeholder={placeholder}
      contentEditable={editable}
      suppressContentEditableWarning
      onInput={(e) => onChange?.((e.target as HTMLElement).innerHTML)}
      onBlur={(e) => onChange?.((e.target as HTMLElement).innerHTML)}
    />
  );
}
