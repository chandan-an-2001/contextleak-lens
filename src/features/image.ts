import type { Redaction, ScanImage } from '../types';
export const MAX_BYTES=20*1024*1024;
export const MAX_PIXELS=24_000_000;
export function validateFile(file:Pick<File,'type'|'size'>){
  if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Choose a PNG, JPG, or WebP screenshot. Other formats are not supported.');
  if(file.size>MAX_BYTES)throw new Error('This file is larger than 20 MB. Choose a smaller screenshot.');
  if(file.size===0)throw new Error('This file is empty. Choose another image.');
}
export async function loadImage(url:string):Promise<HTMLImageElement>{
  const img=new Image();img.src=url;
  try{await img.decode();}catch{throw new Error('This image could not be read. It may be damaged or use an unsupported encoding.');}
  return img;
}
export async function importFile(file:File):Promise<ScanImage>{
  validateFile(file);
  const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());
  const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;
  const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  const webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
  if(!png&&!jpg&&!webp)throw new Error('This file does not contain a supported image. Choose a real PNG, JPG, or WebP file.');
  const url=URL.createObjectURL(file);
  try{const img=await loadImage(url);if(img.naturalWidth*img.naturalHeight>MAX_PIXELS||img.naturalWidth>16000||img.naturalHeight>16000)throw new Error('This image exceeds the 24-megapixel or 16,000-pixel edge limit. Crop it first.');
    return {url,width:img.naturalWidth,height:img.naturalHeight,name:file.name,size:file.size};
  }catch(error){URL.revokeObjectURL(url);throw error;}
}
export async function flatten(image:ScanImage,regions:Redaction[]):Promise<HTMLCanvasElement>{
  const img=await loadImage(image.url);const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Your browser could not create an image canvas.');
  ctx.drawImage(img,0,0);
  ctx.globalAlpha=1;
  for(const r of regions){ctx.fillStyle=/^#[0-9a-f]{6}$/i.test(r.color)?r.color:'#000000';const x=Math.floor(r.box.x),y=Math.floor(r.box.y);ctx.fillRect(x,y,Math.ceil(r.box.x+r.box.width)-x,Math.ceil(r.box.y+r.box.height)-y);}
  return canvas;
}
export function canvasBlob(canvas:HTMLCanvasElement):Promise<Blob>{return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('The browser could not encode the output image.')),'image/png'));}
export function downloadBlob(blob:Blob,name:string){const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
export async function exportImage(image:ScanImage,regions:Redaction[]){const canvas=await flatten(image,regions);try{downloadBlob(await canvasBlob(canvas),'contextleak-redacted.png');}finally{canvas.width=0;canvas.height=0;}}
