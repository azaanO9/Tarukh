"use client";

import { useEffect, useRef } from "react";
import { redValleyArt, redValleyLayers, redValleyShots } from "../content/redValley";
import { assetUrl } from "../lib/assetUrl";

const artUrl = (name: string) => assetUrl(`${redValleyArt.directory}/${name}.webp`);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const mix = (from: number, to: number, t: number) => from + (to - from) * t;
const easeOut = (t: number) => 1 - (1 - clamp(t, 0, 1)) ** 3;
const perspective = 1400;
const settled = 2.3; // Seconds, including the last plane's stagger.

function mountScene(viewport: HTMLDivElement, world: HTMLDivElement) {
  const { width, height } = redValleyArt;
  const planes = redValleyLayers.map(layer => {
    const image = new Image();
    image.alt = "";
    image.draggable = false;
    image.style.left = layer.left + "px";
    image.style.top = layer.top + "px";
    // Each trimmed plate pivots around the centre of the original illustration.
    image.style.transformOrigin = `${width / 2 - layer.left}px ${height / 2 - layer.top}px`;
    return image;
  });

  let viewWidth = viewport.clientWidth, viewHeight = viewport.clientHeight;
  const wideShotBias = () => .22 * clamp((1.3 - viewWidth / Math.max(1, viewHeight)) / .8, 0, 1);
  let frame = 0, elapsed = 0, entry = 0;
  let x = redValleyShots[0].x + wideShotBias();
  let y: number = redValleyShots[0].y;
  let zoom: number = redValleyShots[0].zoom;
  let fromX = x, fromY = y, fromZoom = zoom;
  let pointerX = 0, pointerY = 0, targetX = 0, targetY = 0;
  let ready = false, disposed = false, playing = false;
  let raf = 0, lastTime = 0;

  function paint() {
    if (!viewWidth || !viewHeight) return;
    const shot = redValleyShots[frame];
    // On a tall screen the centre crop loses both moons. Keep the large moon in the wide shot.
    const portraitBias = frame === 0 ? wideShotBias() : 0;
    const pan = easeOut(entry / 1.55);
    x = mix(fromX, shot.x + portraitBias, pan);
    y = mix(fromY, shot.y, pan);
    zoom = mix(fromZoom, shot.zoom, pan);
    const cover = Math.max(viewWidth / width, viewHeight / height);
    const scale = cover * 1.07 * zoom * (1 + .006 * Math.sin(elapsed * .15));
    const padding = Math.min(53 * scale, (width * scale - viewWidth) / 2, (height * scale - viewHeight) / 2);
    const left = clamp(viewWidth / 2 - width * scale * x, viewWidth - width * scale + padding, -padding);
    const top = clamp(viewHeight / 2 - height * scale * y, viewHeight - height * scale + padding, -padding);

    if (!ready) {
      viewport.style.backgroundSize = `${width * scale}px ${height * scale}px`;
      viewport.style.backgroundPosition = `${left}px ${top}px`;
      return;
    }
    viewport.style.perspectiveOrigin = `${left + width * scale / 2}px ${top + height * scale / 2}px`;
    world.style.transform = `translate3d(${left}px, ${top}px, 0) scale(${scale})`;
    const driftX = (.60 * Math.sin(elapsed * .22) + .24 * Math.sin(elapsed * .39 + .7) + pointerX * 1.25) * .85;
    const driftY = (.56 * Math.sin(elapsed * .26 + .4) + pointerY * .95) * .85;

    redValleyLayers.forEach((layer, i) => {
      const entrance = 1 - easeOut((entry - i * .045) / 2);
      const dx = driftX * (3 + 17 * layer.depth) + entrance * layer.enterX;
      const dy = driftY * (1.5 + 8 * layer.depth) + entrance * layer.enterY;
      const z = layer.depth * 180;
      // Compensate for perspective so the six plates line up at rest.
      const size = (1 - z / perspective) * (1 + entrance * .033 * layer.depth);
      const angle = entrance * (layer.depth > .9 ? -.6 : .14 * layer.depth);
      planes[i].style.transform = `translate3d(${dx}px, ${dy}px, ${z}px) scale(${size}) rotate(${angle}deg)`;
    });
  }

  function animate(now: number) {
    const dt = lastTime ? Math.min((now - lastTime) / 1000, .05) : 0;
    lastTime = now;
    elapsed += dt;
    entry += dt;
    const follow = 1 - Math.exp(-4 * dt);
    pointerX = mix(pointerX, targetX, follow);
    pointerY = mix(pointerY, targetY, follow);
    paint();
    raf = requestAnimationFrame(animate);
  }
  function syncPlayback() {
    cancelAnimationFrame(raf);
    lastTime = 0;
    if (playing && ready && !document.hidden) raf = requestAnimationFrame(animate);
  }
  function resize() {
    viewWidth = viewport.clientWidth;
    viewHeight = viewport.clientHeight;
    paint();
  }
  function point(event: PointerEvent) {
    if (!playing || !viewWidth || !viewHeight) return;
    targetX = clamp(2 * event.clientX / viewWidth - 1, -1, 1);
    targetY = clamp(2 * event.clientY / viewHeight - 1, -1, 1);
    menu?.style.setProperty("--menu-rotate-y", `${targetX * .7}deg`);
    menu?.style.setProperty("--menu-rotate-x", `${targetY * -.5}deg`);
  }
  function centre() {
    targetX = 0; targetY = 0;
    menu?.style.setProperty("--menu-rotate-x", "0deg");
    menu?.style.setProperty("--menu-rotate-y", "0deg");
  }

  // Observe input on the menu. The decorative planes never receive taps or focus.
  const menu = viewport.closest("main");
  menu?.addEventListener("pointermove", point, { passive: true });
  menu?.addEventListener("pointerleave", centre);
  menu?.addEventListener("pointerup", centre);
  menu?.addEventListener("pointercancel", centre);
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", syncPlayback);
  paint();

  // Finish the complete poster first so decorative plates do not compete with
  // the first useful screen on a slow connection. Every original plate follows.
  const poster = new Image();
  poster.fetchPriority = "high";
  poster.src = artUrl("poster");
  poster.decode().catch(() => {}).then(() => {
    if (disposed) return;
    return Promise.all(planes.map((image, index) => {
      image.src = artUrl(redValleyLayers[index].name);
      return image.decode();
    }));
  }).then(() => {
    if (disposed) return;
    if (!playing) entry = settled;
    world.replaceChildren(...planes);
    ready = true;
    paint();
    syncPlayback();
  }).catch(() => {
    // A failed plate leaves a complete, navigable poster for all three shots.
    if (!disposed) { entry = settled; paint(); }
  });

  return {
    select(next: number) {
      if (next === frame) return;
      fromX = x; fromY = y; fromZoom = zoom;
      frame = next;
      entry = playing && ready ? 0 : settled;
      paint();
    },
    play(value: boolean) {
      playing = value;
      syncPlayback();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      menu?.removeEventListener("pointermove", point);
      menu?.removeEventListener("pointerleave", centre);
      menu?.removeEventListener("pointerup", centre);
      menu?.removeEventListener("pointercancel", centre);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", syncPlayback);
      world.replaceChildren();
    },
  };
}

export default function RedValleyBackdrop({ shot, playing }: { shot: number; playing: boolean }) {
  const viewport = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const scene = useRef<ReturnType<typeof mountScene> | null>(null);

  useEffect(() => {
    if (!viewport.current || !world.current) return;
    const player = mountScene(viewport.current, world.current);
    scene.current = player;
    return () => { player.dispose(); scene.current = null; };
  }, []);
  useEffect(() => { scene.current?.play(playing); }, [playing]);
  useEffect(() => { scene.current?.select(shot); }, [shot]);

  return <div ref={viewport} className="tarukh-valley" style={{ backgroundImage: `url("${artUrl("poster")}")`, perspective }}>
    <div ref={world} className="tarukh-valley-world" style={{ width: redValleyArt.width, height: redValleyArt.height }} />
  </div>;
}
