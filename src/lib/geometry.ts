import type { Box, Redaction } from '../types';

export function normalizeBox(a: {x:number;y:number}, b:{x:number;y:number}): Box {
  return { x: Math.min(a.x,b.x), y: Math.min(a.y,b.y), width: Math.abs(b.x-a.x), height: Math.abs(b.y-a.y) };
}
export function clampBox(b: Box, width: number, height: number): Box {
  const x = Math.max(0, Math.min(width-1,b.x));
  const y = Math.max(0, Math.min(height-1,b.y));
  return { x, y, width: Math.max(1,Math.min(width-x,b.width)), height: Math.max(1,Math.min(height-y,b.height)) };
}
export function clientToImage(clientX:number,clientY:number,rect: Pick<DOMRect,'left'|'top'|'width'|'height'>,width:number,height:number) {
  return { x: Math.max(0,Math.min(width,(clientX-rect.left)/rect.width*width)), y: Math.max(0,Math.min(height,(clientY-rect.top)/rect.height*height)) };
}
export function unionBox(boxes: Box[]): Box {
  const x=Math.min(...boxes.map(b=>b.x)), y=Math.min(...boxes.map(b=>b.y));
  return {x,y,width:Math.max(...boxes.map(b=>b.x+b.width))-x,height:Math.max(...boxes.map(b=>b.y+b.height))-y};
}
export function inflate(b: Box,padding=5): Box { return {x:Math.max(0,b.x-padding),y:Math.max(0,b.y-padding),width:b.width+padding*2,height:b.height+padding*2}; }
export function covered(box:Box,regions:Redaction[]): boolean {
  // Union coverage: multiple overlapping masks may jointly cover a finding.
  const cuts=[box.x,box.x+box.width,...regions.flatMap(r=>[Math.max(box.x,r.box.x),Math.min(box.x+box.width,r.box.x+r.box.width)])].filter(x=>x>=box.x&&x<=box.x+box.width).sort((a,b)=>a-b);
  let area=0;
  for(let i=1;i<cuts.length;i++){
    const left=cuts[i-1],right=cuts[i]; if(right<=left) continue;
    const spans=regions.filter(r=>r.box.x<=left&&r.box.x+r.box.width>=right).map(r=>[Math.max(box.y,r.box.y),Math.min(box.y+box.height,r.box.y+r.box.height)]).filter(s=>s[1]>s[0]).sort((a,b)=>a[0]-b[0]);
    let end=box.y, length=0;
    for(const [s,e] of spans){if(e>end){length+=e-Math.max(s,end);end=e;}}
    area+=(right-left)*length;
  }
  return area>=box.width*box.height-0.1;
}
export const regionSignature=(regions:Redaction[])=>JSON.stringify(regions.map(r=>[r.id,r.box,r.color]));
