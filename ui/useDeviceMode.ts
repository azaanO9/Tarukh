"use client";
import {useSyncExternalStore} from 'react';
import {isTouchPortrait,type DeviceMode} from '../game/deviceMode';
import {readDeviceMode,subscribeDeviceChanges} from './mobileDevice';

const serverMode=():DeviceMode|null=>null;
export function useDeviceMode():DeviceMode|null {
  return useSyncExternalStore(subscribeDeviceChanges,readDeviceMode,serverMode);
}

const readPortrait=()=>isTouchPortrait(window.innerWidth,window.innerHeight,readDeviceMode());
const serverPortrait=()=>false;
export function useTouchPortrait():boolean {
  return useSyncExternalStore(subscribeDeviceChanges,readPortrait,serverPortrait);
}
