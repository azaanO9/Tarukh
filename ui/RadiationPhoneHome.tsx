import { Activity, BookOpen, Layers3, Map, RadioTower, Settings2 } from "lucide-react";
import type { ReactNode } from "react";

type PhoneApp = "telemetry" | "systems" | "data" | "settings";

interface Props {
  logoSrc: string;
  onOpenApp: (app: PhoneApp) => void;
  onOpenMap?: () => void;
  onOpenGuide: () => void;
  dose: number;
  health: number;
  storm: string;
  modeLabel: string;
}

function AppButton({ label, tone, icon, onClick }: {
  label: string;
  tone: string;
  icon: ReactNode;
  onClick?: () => void;
}) {
  return <button type="button" className="handset-app" onClick={onClick} disabled={!onClick}>
    <span className={`handset-app-icon ${tone}`} aria-hidden="true">{icon}</span>
    <span>{label}</span>
  </button>;
}

/** Original phone home; each tile opens an existing game tool. */
export default function RadiationPhoneHome({
  logoSrc, onOpenApp, onOpenMap, onOpenGuide, dose, health, storm, modeLabel,
}: Props) {
  return <section className="handset-home" aria-label="Phone home">
    <div className="handset-home-brand">
      {/* Pages and Sites serve this local asset directly, without a Next image optimizer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="handset-home-logo" src={logoSrc} alt="TARUKH" width="260" height="130" decoding="async" loading="lazy" draggable={false} />
      <p>SURFACE OPERATIONS</p>
    </div>
    <div className="handset-app-grid" aria-label="Explorer apps">
      <AppButton label="Radiation" tone="app-radiation" icon={<Activity />} onClick={() => onOpenApp("telemetry")} />
      <AppButton label="Systems" tone="app-systems" icon={<Layers3 />} onClick={() => onOpenApp("systems")} />
      <AppButton label="Archive" tone="app-archive" icon={<RadioTower />} onClick={() => onOpenApp("data")} />
      <AppButton label="Settings" tone="app-settings" icon={<Settings2 />} onClick={() => onOpenApp("settings")} />
      <AppButton label="Field map" tone="app-map" icon={<Map />} onClick={onOpenMap} />
      <AppButton label="Science guide" tone="app-guide" icon={<BookOpen />} onClick={onOpenGuide} />
    </div>
    <div className="handset-home-readout">
      <div className="handset-readout-title"><span>EXPLORER STATUS</span><span>{modeLabel}</span></div>
      <dl>
        <div><dt>Game dose</dt><dd>{dose.toFixed(2)} <small>mSv</small></dd></div>
        <div><dt>Suit health</dt><dd>{Math.round(health)}%</dd></div>
        <div><dt>Storm level</dt><dd>{storm}</dd></div>
      </dl>
    </div>
  </section>;
}
