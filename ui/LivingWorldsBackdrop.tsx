"use client";

import { useEffect, useRef } from "react";
import { assetUrl } from "../lib/assetUrl";
import { DepthScene } from "./depth-scenes/living-worlds/scene.js";
import "./depth-scenes/living-worlds/scene.css";

export default function LivingWorldsBackdrop({ playing }: { playing: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<DepthScene | null>(null);
  const initialPlayback = useRef(playing);

  useEffect(() => {
    if (!container.current) return;
    const instance = new DepthScene(container.current, {
      assetBase: new URL(assetUrl("art/main-menu/living-worlds/assets/"), window.location.href),
      autoplay: initialPlayback.current,
    });
    scene.current = instance;
    void instance.ready.catch(() => undefined);
    return () => {
      scene.current = null;
      instance.destroy();
    };
  }, []);

  useEffect(() => {
    if (playing) scene.current?.play();
    else scene.current?.pause();
  }, [playing]);

  return <div ref={container} className="tarukh-home-living-worlds" />;
}
