export interface ElysiumWorldCommand {
  revision: number;
  roverCharge: number;
  chargingAllowed: boolean;
  maxCharge: number;
  roverAllowed?: boolean;
  night?: boolean;
}

/** Apply after vehicle physics so roof panels cannot bypass a base power plan. */
export function allocatedRoverCharge(previous: number, current: number, command: ElysiumWorldCommand) {
  const ceiling = command.chargingAllowed ? command.maxCharge : Math.min(previous, command.maxCharge);
  return Math.max(0, Math.min(current, ceiling));
}

/** Visual transition only: a paused planning dialog never consumes resources. */
export function approachStoryDaylight(seconds: number, night: boolean, dt: number) {
  const phase = Math.max(0, seconds) % 600;
  return phase + ((night ? 300 : 600) - phase) * (1 - Math.exp(-Math.max(0, dt)));
}

/** Optional bridge. Free Exploration never creates or advances mission state. */
export interface ElysiumWorldBridge {
  sessionId: string;
  command: ElysiumWorldCommand;
  simulatedDose?: number;
  targetSiteId?: string;
  route?: 'direct' | 'ridge' | 'valley';
  routePoints?: readonly {x:number;z:number}[];
  ending?: boolean;
  onEndingComplete?: () => void;
  onInteract: (siteId: string) => void;
}
