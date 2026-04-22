import { useEditor } from '../editor/store';
import { importImageFiles } from '../editor/export';
import type { ShapeKind } from '../editor/types';

export function LeftToolbar() {
  const addText = useEditor((s) => s.addTextObject);
  const addShape = useEditor((s) => s.addShapeObject);
  const onImport = () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.multiple = true;
    inp.onchange = () => inp.files && importImageFiles(inp.files);
    inp.click();
  };
  return (
    <div className="pointer-events-auto absolute left-2 top-12 z-10 flex flex-col gap-0.5 rounded-md border border-black/40 bg-panel/90 p-0.5 text-[11px] backdrop-blur">
      <ToolBtn label="Add text (T)" onClick={() => addText()}>
        T
      </ToolBtn>
      <ToolBtn label="Import image" onClick={onImport}>
        +
      </ToolBtn>
      <Divider />
      <ShapeBtn label="Rectangle" kind="rectangle" onAdd={addShape}>
        <rect x={3} y={3} width={12} height={12} rx={1.5} />
      </ShapeBtn>
      <ShapeBtn label="Ellipse" kind="ellipse" onAdd={addShape}>
        <ellipse cx={9} cy={9} rx={6.5} ry={6.5} />
      </ShapeBtn>
      <ShapeBtn label="Triangle" kind="triangle" onAdd={addShape}>
        <polygon points="9,2.5 16,15.5 2,15.5" />
      </ShapeBtn>
      <ShapeBtn label="Line" kind="line" onAdd={addShape} stroke>
        <line x1={3} y1={15} x2={15} y2={3} />
      </ShapeBtn>
    </div>
  );
}

function Divider() {
  return <div className="my-0.5 h-px bg-black/40" />;
}

function ToolBtn({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="grid h-7 w-7 place-items-center rounded text-sm font-semibold text-zinc-200 hover:bg-panel-3"
    >
      {children}
    </button>
  );
}

function ShapeBtn({
  children,
  label,
  kind,
  onAdd,
  stroke,
}: {
  children: React.ReactNode;
  label: string;
  kind: ShapeKind;
  onAdd: (k: ShapeKind) => void;
  stroke?: boolean;
}) {
  return (
    <button
      onClick={() => onAdd(kind)}
      title={label}
      className="grid h-7 w-7 place-items-center rounded text-zinc-200 hover:bg-panel-3"
    >
      <svg
        viewBox="0 0 18 18"
        width={16}
        height={16}
        fill={stroke ? 'none' : 'currentColor'}
        stroke="currentColor"
        strokeWidth={stroke ? 2 : 1.25}
        strokeLinecap="round"
      >
        {children}
      </svg>
    </button>
  );
}
