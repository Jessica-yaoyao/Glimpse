import type { GeoLocation } from '../types/inspiration';
interface MapBridge { postMessage(message:Record<string,unknown>):Promise<unknown> }
function bridge():MapBridge|undefined{return (window.webkit?.messageHandlers as unknown as Record<string,MapBridge>|undefined)?.glimpseMap;}
export interface MapProvider { open(ids:string[],month?:string):Promise<string|null>; pick():Promise<GeoLocation|null> }
export interface LocationProvider { current():Promise<GeoLocation> }
export function nativeMapAvailable(){return Boolean(bridge());}
export class SystemMapProvider implements MapProvider {
  async open(ids:string[],month='all') {const native=bridge();if(!native)throw new Error('系统地图请在 macOS 应用打开。照片与坐标仍可在下方列表回看。');try{const reply=await native.postMessage({action:'open',ids,month}) as {id?:string};return reply.id??null;}catch(e){if(String(e).includes('地图已关闭'))return null;throw e;}}
  async pick(){const native=bridge();if(!native)throw new Error('地图选点请使用 macOS 应用；也可填写经纬度。');try{return await native.postMessage({action:'pick'}) as GeoLocation;}catch(e){if(String(e).includes('地图已关闭'))return null;throw e;}}
}
export class SystemLocationProvider implements LocationProvider {
  async current():Promise<GeoLocation>{const native=bridge();if(native)return await native.postMessage({action:'current'}) as GeoLocation;
    return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(position=>resolve({latitude:position.coords.latitude,longitude:position.coords.longitude,coordinateSystem:'WGS84',source:'current',recordedAt:position.timestamp,accuracy:position.coords.accuracy}),()=>reject(new Error('当前位置不可用或未获授权；仍可手工标注或不记录位置。')),{timeout:15000,maximumAge:0}));}
}
export const mapProvider:MapProvider=new SystemMapProvider();
export const locationProvider:LocationProvider=new SystemLocationProvider();
