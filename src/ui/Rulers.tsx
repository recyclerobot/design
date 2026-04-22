import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useEditor } from '../editor/store';
import { useUI } from './uiStore';

const RULER_PX = 22;
const RULER_BG = '#15161a';
const RULER_FG = '#9aa0a8';
const TICK_COLOR = '#3a3d44';
const CURSOR_COLOR = '#5865f2';
const GUIDE_COLOR = '#22d3ee';

/**
 * Top + left rulers with tick labels, cursor markers, and drag-to-create
 * guides. The user can drag a ruler edge into the canvas to create a guide,
 * or drag an existing guide back onto the ruler to delete it.
 *
 * Positioning math mirrors PixiScene.setView:
 *   worldOriginScreenX = viewportW/2 - docW*zoom/2 + panX
 *   screenX = worldOriginScreenX + docX * zoom
 */
export function Rulers() {
  const showRulers = useUI((s) => s.panels.rulers);
  const showGuides = useUI((s) => s.panels.guides);
  const view = useEditor((s) => s.view);
  const doc = useEditor((s) => s.doc);
  const guides = doc.guides ?? [];
  const addGuide = useEditor((s) => s.addGuide);
  const updateGuide = useEditor((s) => s.updateGuide);
  const removeGuide = useEditor((s) => s.removeGuide);

  // Track viewport size so origin math matches Pixi's renderer dims.
  const [size, setSize] = useState<{ w: number; h: number }>({
    w: typeof window !== 'undefined' ? window.innerWidth : 1280,
    h: typeof window !== 'undefined' ? window.innerHeight : 800,
  });
  useLayoutEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Mouse position for cursor markers.
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const onMove = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
    const onLeave = () => setMouse(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  // Live drag of a brand-new or existing guide. While the pointer is held we
  // bypass the store and render straight from this state for crispness.
  type GuideDrag =
    | { kind: 'new'; axis: 'v' | 'h'; pos: number }
    | { kind: 'existing'; index: number; axis: 'v' | 'h'; pos: number };
  const [guideDrag, setGuideDrag] = useState<GuideDrag | null>(null);
  const guideDragRef = useRef<GuideDrag | null>(null);
  guideDragRef.current = guideDrag;

  const worldOriginX = size.w / 2 - (doc.widthPx * view.zoom) / 2 + view.panX;
  const worldOriginY = size.h / 2 - (doc.heightPx * view.zoom) / 2 + view.panY;
  const docXFromScreen = (sx: number) => (sx - worldOriginX) / view.zoom;
  const docYFromScreen = (sy: number) => (sy - worldOriginY) / view.zoom;
  const screenXFromDoc = (dx: number) => worldOriginX + dx * view.zoom;
  const screenYFromDoc = (dy: number) => worldOriginY + dy * view.zoom;

  // Pointer drag for guides
  useEffect(() => {
    if (!guideDrag) return;
    const onMove = (e: PointerEvent) => {
      const cur = guideDragRef.current!;
      const pos = cur.axis === 'v' ? docXFromScreen(e.clientX) : docYFromScreen(e.clientY);
      const next: GuideDrag = { ...cur, pos };
      setGuideDrag(next);
      guideDragRef.current = next;
    };
    const onUp = (e: PointerEvent) => {
      const cur = guideDragRef.current!;
      // Drop in ruler bar = delete (or no-op if it was a brand-new guide).
      const inTopRuler = e.clientY < RULER_PX;
      const inLeftRuler = e.clientX < RULER_PX;
      const droppedOnRuler = (cur.axis === 'h' && inTopRuler) || (cur.axis === 'v' && inLeftRuler);
      if (cur.kind === 'existing') {
        if (droppedOnRuler) {
          removeGuide(cur.index);
        } else {
          updateGuide(cur.index, { axis: cur.axis, pos: Math.round(cur.pos) });
        }
      } else if (cur.kind === 'new' && !droppedOnRuler) {
        addGuide({ axis: cur.axis, pos: Math.round(cur.pos) });
      }
      setGuideDrag(null);
      guideDragRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guideDrag, view.zoom, view.panX, view.panY, size.w, size.h]);

  if (!showRulers && !showGuides) return null;

  return (
    <div data-ui-overlay className="pointer-events-none absolute inset-0" style={{ zIndex: 5 }}>
      {/* Top ruler */}
      {showRulers && (
        <RulerBar
          axis="h"
          length={size.w}
          docOrigin={worldOriginX}
          zoom={view.zoom}
          docMin={0}
          docMax={doc.widthPx}
          cursorScreen={mouse?.x ?? null}
          onCreateGuide={(pos) => {
            const dr: GuideDrag = { kind: 'new', axis: 'h', pos };
            setGuideDrag(dr);
            guideDragRef.current = dr;
          }}
        />
      )}
      {/* Left ruler */}
      {showRulers && (
        <RulerBar
          axis="v"
          length={size.h}
          docOrigin={worldOriginY}
          zoom={view.zoom}
          docMin={0}
          docMax={doc.heightPx}
          cursorScreen={mouse?.y ?? null}
          onCreateGuide={(pos) => {
            const dr: GuideDrag = { kind: 'new', axis: 'v', pos };
            setGuideDrag(dr);
            guideDragRef.current = dr;
          }}
        />
      )}
      {/* Corner square */}
      {showRulers && (
        <div
          className="pointer-events-auto absolute"
          style={{
            left: 0,
            top: 0,
            width: RULER_PX,
            height: RULER_PX,
            background: RULER_BG,
            borderRight: '1px solid #2a2c33',
            borderBottom: '1px solid #2a2c33',
          }}
          title="Clear all guides"
          onDoubleClick={() => useEditor.getState().clearGuides()}
        />
      )}

      {/* Existing guides */}
      {showGuides &&
        guides.map((g, i) => {
          // If this guide is being dragged, render the drag preview instead.
          if (guideDrag && guideDrag.kind === 'existing' && guideDrag.index === i) return null;
          const screen = g.axis === 'v' ? screenXFromDoc(g.pos) : screenYFromDoc(g.pos);
          return (
            <GuideLineEl
              key={`g${i}`}
              axis={g.axis}
              screen={screen}
              dim={size}
              onPointerDown={(e) => {
                e.preventDefault();
                const dr: GuideDrag = { kind: 'existing', index: i, axis: g.axis, pos: g.pos };
                setGuideDrag(dr);
                guideDragRef.current = dr;
              }}
            />
          );
        })}

      {/* Drag preview */}
      {guideDrag &&
        (() => {
          const axis = guideDrag.axis;
          const screen =
            axis === 'v' ? screenXFromDoc(guideDrag.pos) : screenYFromDoc(guideDrag.pos);
          return <GuideLineEl key="drag" axis={axis} screen={screen} dim={size} dashed />;
        })()}
    </div>
  );
}

interface RulerProps {
  axis: 'h' | 'v';
  /** screen length of this ruler in px */
  length: number;
  /** screen-pixel position where doc 0 sits along this axis */
  docOrigin: number;
  zoom: number;
  docMin: number;
  docMax: number;
  cursorScreen: number | null;
  onCreateGuide: (docPos: number) => void;
}

function RulerBar({
  axis,
  length,
  docOrigin,
  zoom,
  docMin,
  docMax,
  cursorScreen,
  onCreateGuide,
}: RulerProps) {
  const isH = axis === 'h';
  const tickStep = chooseTickStep(zoom);

  // Compute visible doc-space range that maps onto [0..length].
  const docVisStart = (0 - docOrigin) / zoom;
  const docVisEnd = (length - docOrigin) / zoom;
  const first = Math.floor(docVisStart / tickStep) * tickStep;
  const last = Math.ceil(docVisEnd / tickStep) * tickStep;

  const ticks: { docPos: number; screen: number; major: boolean }[] = [];
  for (let v = first; v <= last; v += tickStep) {
    const screen = docOrigin + v * zoom;
    ticks.push({ docPos: v, screen, major: Math.round(v) % (tickStep * 5) === 0 });
  }

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const docPos = isH ? (e.clientX - docOrigin) / zoom : (e.clientY - docOrigin) / zoom;
    onCreateGuide(docPos);
  };

  return (
    <div
      onPointerDown={onPointerDown}
      className="pointer-events-auto absolute select-none"
      style={{
        left: isH ? RULER_PX : 0,
        top: isH ? 0 : RULER_PX,
        width: isH ? length - RULER_PX : RULER_PX,
        height: isH ? RULER_PX : length - RULER_PX,
        background: RULER_BG,
        borderBottom: isH ? '1px solid #2a2c33' : 'none',
        borderRight: isH ? 'none' : '1px solid #2a2c33',
        cursor: isH ? 'ns-resize' : 'ew-resize',
      }}
    >
      <svg
        width={isH ? length - RULER_PX : RULER_PX}
        height={isH ? RULER_PX : length - RULER_PX}
        style={{ display: 'block' }}
      >
        {/* doc-bounds shading */}
        {(() => {
          const a = docOrigin + docMin * zoom - (isH ? RULER_PX : RULER_PX);
          const b = docOrigin + docMax * zoom - (isH ? RULER_PX : RULER_PX);
          if (b <= 0 || a >= (isH ? length - RULER_PX : length - RULER_PX)) return null;
          const start = Math.max(0, a);
          const end = Math.min(isH ? length - RULER_PX : length - RULER_PX, b);
          if (isH) {
            return <rect x={start} y={0} width={end - start} height={RULER_PX} fill="#1d1f25" />;
          }
          return <rect x={0} y={start} width={RULER_PX} height={end - start} fill="#1d1f25" />;
        })()}

        {/* ticks */}
        {ticks.map((t, i) => {
          const local = t.screen - RULER_PX;
          if (isH) {
            const h = t.major ? RULER_PX : RULER_PX * 0.5;
            return (
              <g key={i}>
                <line
                  x1={local}
                  x2={local}
                  y1={RULER_PX - h}
                  y2={RULER_PX}
                  stroke={TICK_COLOR}
                  strokeWidth={1}
                />
                {t.major && (
                  <text
                    x={local + 2}
                    y={9}
                    fontSize={9}
                    fill={RULER_FG}
                    style={{ fontFamily: 'ui-monospace, monospace' }}
                  >
                    {Math.round(t.docPos)}
                  </text>
                )}
              </g>
            );
          }
          const w = t.major ? RULER_PX : RULER_PX * 0.5;
          return (
            <g key={i}>
              <line
                x1={RULER_PX - w}
                x2={RULER_PX}
                y1={local}
                y2={local}
                stroke={TICK_COLOR}
                strokeWidth={1}
              />
              {t.major && (
                <text
                  x={2}
                  y={local + 8}
                  fontSize={9}
                  fill={RULER_FG}
                  style={{ fontFamily: 'ui-monospace, monospace' }}
                >
                  {Math.round(t.docPos)}
                </text>
              )}
            </g>
          );
        })}

        {/* cursor marker */}
        {cursorScreen !== null && cursorScreen > RULER_PX && (
          <line
            x1={isH ? cursorScreen - RULER_PX : 0}
            x2={isH ? cursorScreen - RULER_PX : RULER_PX}
            y1={isH ? 0 : cursorScreen - RULER_PX}
            y2={isH ? RULER_PX : cursorScreen - RULER_PX}
            stroke={CURSOR_COLOR}
            strokeWidth={1}
          />
        )}
      </svg>
    </div>
  );
}

function chooseTickStep(zoom: number): number {
  // Aim for ~50px between major ticks.
  const targetPx = 50;
  const docPerPx = 1 / zoom;
  const raw = targetPx * docPerPx;
  const candidates = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
  for (const c of candidates) if (c >= raw) return c / 5;
  return 1000;
}

function GuideLineEl({
  axis,
  screen,
  dim,
  onPointerDown,
  dashed,
}: {
  axis: 'v' | 'h';
  /** screen-pixel position along the axis */
  screen: number;
  dim: { w: number; h: number };
  onPointerDown?: (e: React.PointerEvent) => void;
  dashed?: boolean;
}) {
  const common = {
    background: GUIDE_COLOR,
    opacity: dashed ? 0.7 : 0.85,
  };
  if (axis === 'v') {
    return (
      <div
        className="pointer-events-auto absolute"
        onPointerDown={onPointerDown}
        style={{
          left: screen - 4,
          top: RULER_PX,
          width: 9,
          height: dim.h - RULER_PX,
          cursor: 'ew-resize',
          background: 'transparent',
        }}
        title="Drag to move; drop on left ruler to delete"
      >
        <div
          style={{
            position: 'absolute',
            left: 4,
            top: 0,
            width: 1,
            height: '100%',
            ...common,
            ...(dashed ? { backgroundImage: 'none', borderLeft: `1px dashed ${GUIDE_COLOR}` } : {}),
          }}
        />
      </div>
    );
  }
  return (
    <div
      className="pointer-events-auto absolute"
      onPointerDown={onPointerDown}
      style={{
        left: RULER_PX,
        top: screen - 4,
        height: 9,
        width: dim.w - RULER_PX,
        cursor: 'ns-resize',
        background: 'transparent',
      }}
      title="Drag to move; drop on top ruler to delete"
    >
      <div
        style={{
          position: 'absolute',
          top: 4,
          left: 0,
          height: 1,
          width: '100%',
          ...common,
          ...(dashed ? { backgroundImage: 'none', borderTop: `1px dashed ${GUIDE_COLOR}` } : {}),
        }}
      />
    </div>
  );
}
