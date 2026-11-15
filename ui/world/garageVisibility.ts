import type { GaragePhase } from '../../game/roverGarage.ts';

/** The closed opaque garage shell completely covers its parked vehicle. */
export function roverHiddenByGarage(phase: GaragePhase, doorAmount: number, playerInside: boolean, driving: boolean) {
  return phase === 'parked' && doorAmount === 0 && !playerInside && !driving;
}
