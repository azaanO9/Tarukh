"use client";

import { useCallback, useEffect, useRef } from "react";
import { assetUrl } from "../lib/assetUrl";

export default function FieldExpeditionBackdrop({ playing }: { playing: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const syncMotion = useCallback(() => {
    const target = frame.current?.contentWindow as (Window & { tarukhSetMotion?: (active: boolean) => void }) | undefined;
    target?.tarukhSetMotion?.(playing);
  }, [playing]);

  useEffect(syncMotion, [syncMotion]);

  return (
    <iframe
      ref={frame}
      className="tarukh-home-field-expedition"
      src={assetUrl("art/main-menu/field-expedition/embed.html")}
      title="Layered Mars field expedition background"
      tabIndex={-1}
      loading="eager"
      onLoad={syncMotion}
    />
  );
}
