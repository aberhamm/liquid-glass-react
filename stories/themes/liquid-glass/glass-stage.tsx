import type { ReactNode } from 'react';
import '../../../styles/glass.css';
import './glass-stage.css';
export function GlassStage({ children }: { children: ReactNode }) {
  return (
    <div className="matui-glass-stage">
      <div className="matui-glass-orb" aria-hidden="true" />
      <div className="matui-glass-content">{children}</div>
    </div>
  );
}
export const glassDocs = `Matui glass components use @samasante/liquid-glass 0.1.1 (MIT). Install @aberhamm/matui and import from '@aberhamm/liquid-glass-react', plus '@aberhamm/liquid-glass-react/styles.css' for controls. Glass (also exported as LiquidGlass) uses upstream props: style for padding and border radius, and optics for the material. Arbitrary live-backdrop bending is Chromium-only; use refract with a decorative copy for Safari/Firefox. Switch, slider and notification are adapted upstream recipes with MIT attribution.`;
