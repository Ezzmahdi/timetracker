"use client";

import { memo, useEffect, useRef } from "react";

interface TubeCanvasProps {
  hours: number;
  maxHours: number;
  color: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 99, g: 102, b: 241 };
}

function TubeCanvas({ hours, maxHours, color }: TubeCanvasProps) {
  const fillTarget = maxHours > 0 ? Math.min(1, hours / maxHours) : 0;
  const fillRef = useRef(0);
  const elRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    let running = true;
    const animate = () => {
      if (!running) return;
      const diff = fillTarget - fillRef.current;
      if (Math.abs(diff) < 0.002) {
        fillRef.current = fillTarget;
        if (elRef.current) {
          elRef.current.style.setProperty("--fill", `${fillTarget * 100}%`);
        }
        return;
      }
      fillRef.current += diff * 0.12;
      if (elRef.current) {
        elRef.current.style.setProperty("--fill", `${fillRef.current * 100}%`);
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [fillTarget]);

  const rgb = hexToRgb(color);
  const lightColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.18)`;
  const medColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.7)`;
  const fullColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.85)`;

  return (
    <div ref={elRef} className="relative w-full h-full flex items-end justify-center" style={{ "--fill": "0%" } as React.CSSProperties}>
      {/* Glass tube outer */}
      <div className="relative w-[52%] h-[92%] flex flex-col">
        {/* Top rim */}
        <div
          className="relative z-10 h-[6px] rounded-t-[6px] mx-[-2px]"
          style={{
            background: "linear-gradient(180deg, #a0a8b8 0%, #c8cdd6 50%, #b0b7c4 100%)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
          }}
        />

        {/* Glass body */}
        <div
          className="relative flex-1 overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(220,225,235,0.25) 0%, rgba(200,208,220,0.12) 40%, rgba(220,225,235,0.18) 100%)",
            borderLeft: "1.5px solid rgba(180,188,200,0.4)",
            borderRight: "1.5px solid rgba(180,188,200,0.3)",
            boxShadow: "inset 2px 0 8px rgba(255,255,255,0.3), inset -2px 0 6px rgba(0,0,0,0.03)",
          }}
        >
          {/* Glass highlight streak */}
          <div
            className="absolute top-0 bottom-0 w-[3px] left-[18%] z-10 pointer-events-none"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.15) 60%, rgba(255,255,255,0.3) 100%)",
              borderRadius: "2px",
            }}
          />
          <div
            className="absolute top-[10%] bottom-[15%] w-[1.5px] left-[28%] z-10 pointer-events-none"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.05) 100%)",
              borderRadius: "1px",
            }}
          />

          {/* Liquid fill */}
          <div
            className="absolute bottom-0 left-0 right-0 transition-none"
            style={{
              height: "var(--fill)",
              background: `linear-gradient(180deg, ${medColor} 0%, ${fullColor} 40%, ${fullColor} 100%)`,
            }}
          >
            {/* Liquid surface / meniscus */}
            <div
              className="absolute top-0 left-0 right-0 h-[6px]"
              style={{
                background: `linear-gradient(180deg, rgba(255,255,255,0.45) 0%, ${medColor} 100%)`,
                borderRadius: "0 0 50% 50% / 0 0 100% 100%",
              }}
            />
            {/* Liquid highlight */}
            <div
              className="absolute top-[8px] bottom-[10%] w-[4px] left-[20%] pointer-events-none"
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.05) 100%)",
                borderRadius: "2px",
              }}
            />
            {/* Subtle bubbles when filling */}
            <div
              className="absolute bottom-[12%] left-[40%] w-[4px] h-[4px] rounded-full pointer-events-none"
              style={{
                background: `rgba(255,255,255,0.25)`,
                opacity: fillTarget > 0.05 ? 1 : 0,
              }}
            />
            <div
              className="absolute bottom-[25%] left-[55%] w-[3px] h-[3px] rounded-full pointer-events-none"
              style={{
                background: `rgba(255,255,255,0.2)`,
                opacity: fillTarget > 0.1 ? 1 : 0,
              }}
            />
          </div>
        </div>

        {/* Rounded bottom */}
        <div
          className="relative h-[16%] overflow-hidden"
          style={{
            borderLeft: "1.5px solid rgba(180,188,200,0.4)",
            borderRight: "1.5px solid rgba(180,188,200,0.3)",
          }}
        >
          {/* Glass bottom curve */}
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(135deg, rgba(220,225,235,0.25) 0%, rgba(200,208,220,0.12) 100%)",
              borderRadius: "0 0 50% 50% / 0 0 100% 100%",
              borderBottom: "1.5px solid rgba(180,188,200,0.35)",
            }}
          />
          {/* Liquid in bottom curve */}
          <div
            className="absolute inset-0"
            style={{
              background: fillTarget > 0 ? `${fullColor}` : "transparent",
              borderRadius: "0 0 50% 50% / 0 0 100% 100%",
              opacity: fillTarget > 0 ? 1 : 0,
              transition: "opacity 0.3s ease",
            }}
          />
          {/* Bottom highlight */}
          <div
            className="absolute top-0 left-[15%] w-[3px] h-[60%] pointer-events-none"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 100%)",
              borderRadius: "2px",
            }}
          />
        </div>

        {/* Shadow under tube */}
        <div
          className="absolute -bottom-[4px] left-[10%] right-[10%] h-[8px] pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at center, rgba(0,0,0,0.08) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Background glow from liquid */}
      {fillTarget > 0 && (
        <div
          className="absolute bottom-0 left-[15%] right-[15%] pointer-events-none"
          style={{
            height: "var(--fill)",
            maxHeight: "92%",
            background: `radial-gradient(ellipse at center, ${lightColor} 0%, transparent 70%)`,
            filter: "blur(8px)",
          }}
        />
      )}
    </div>
  );
}

export default memo(TubeCanvas);
