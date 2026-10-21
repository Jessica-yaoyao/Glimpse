interface PresentationBridge { postMessage(message: {action: string}): Promise<unknown> }
function bridge() { return (window.webkit?.messageHandlers as unknown as Record<string,PresentationBridge>|undefined)?.glimpsePresentation; }
const key='glimpse.presentation.v1';
export async function introductionComplete():Promise<boolean> {
  const native=bridge(); if(native){const value=await native.postMessage({action:'read'}); if(!value||typeof value!=='object'||!('complete' in value)||typeof value.complete!=='boolean')throw new Error('开屏设置无法读取，请重试。');return value.complete;}
  return localStorage.getItem(key)==='complete';
}
export async function completeIntroduction() { const native=bridge(); if(native)await native.postMessage({action:'complete'}); else localStorage.setItem(key,'complete'); }
