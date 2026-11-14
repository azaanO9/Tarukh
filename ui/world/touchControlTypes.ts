import type { MoveAxes } from "../../game/navigation";
import type { RoverAnalogInput } from "../../game/roverVehicle";

export type TouchControlProps = {
  enabled: boolean;
  roverDriving: boolean;
  roverNear: boolean;
  canInspect: boolean;
  thirdPerson: boolean;
  onWalkAxes: (axes: MoveAxes) => void;
  onDriveAxes: (axes: RoverAnalogInput) => void;
  onHoldKey: (key: string, active: boolean) => void;
  onToggleView: () => void;
  onToggleRover: () => void;
  onInspectNearby: () => void;
};
