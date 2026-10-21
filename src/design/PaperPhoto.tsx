import stamp from './vectors/frame-stamp.svg';
import kraft from './vectors/frame-kraft.svg';
import palette from './vectors/frame-palette.svg';
import niceDay from './vectors/nice-day.svg';
import keepGoing from './vectors/keep-going.svg';
const frames={stamp:{src:stamp,slot:[37,46,163,110]},kraft:{src:kraft,slot:[65,47,116,101]},palette:{src:palette,slot:[59,43,148,103]}};
export type FrameKind=keyof typeof frames;
export function frameFor(id:string):FrameKind {let hash=0;for(const char of id)hash=(hash*31+char.charCodeAt(0))>>>0;return (['stamp','kraft','palette'] as FrameKind[])[hash%3];}
export function PaperPhoto({src,id,variant}:{src:string;id:string;variant?:FrameKind}) {const kind=variant??frameFor(id),frame=frames[kind],[x,y,w,h]=frame.slot;return <span className={`paper-photo paper-photo-${kind}`} data-frame={kind}><img className="paper-photo-image" src={src} alt="记录的照片" style={{left:`${x/240*100}%`,top:`${y/192*100}%`,width:`${w/240*100}%`,height:`${h/192*100}%`}}/><img className="paper-photo-frame" src={frame.src} alt="" aria-hidden="true"/></span>;}
export function Doodle({kind}:{kind:'nice-day'|'keep-going'}) {return <img className={`doodle doodle-${kind}`} src={kind==='nice-day'?niceDay:keepGoing} alt="" aria-hidden="true" draggable={false}/>;}
