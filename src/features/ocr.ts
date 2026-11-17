import { createWorker, OEM, PSM } from 'tesseract.js';
import type { OCRResult, OCRLine } from '../types';

export async function runOCR(input:HTMLCanvasElement|string,onProgress:(progress:number,status:string)=>void,signal:AbortSignal):Promise<OCRResult>{
  const started=performance.now();
  let worker:Awaited<ReturnType<typeof createWorker>>|undefined;
  let timeout:ReturnType<typeof setTimeout>|undefined;
  const abort=()=>{void worker?.terminate().catch(()=>undefined);};
  signal.addEventListener('abort',abort,{once:true});
  try{
    if(signal.aborted)throw new DOMException('Cancelled','AbortError');
    const base=new URL(`${import.meta.env.BASE_URL}ocr/`,document.baseURI).href;
    const task=(async()=>{
      worker=await createWorker('eng',OEM.LSTM_ONLY,{
        workerPath:`${base}worker.min.js`,corePath:base,langPath:base.replace(/\/$/,''),
        workerBlobURL:false,cacheMethod:'none',
        logger:message=>{if(!signal.aborted){const pct=message.status==='recognizing text'?25+Math.round((message.progress||0)*70):Math.max(4,Math.round((message.progress||0)*24));onProgress(pct,message.status==='recognizing text'?'Reading visible text on your device':'Preparing local OCR engine');}},
        errorHandler:()=>{ /* Worker errors are handled by the task; never log private OCR inputs. */ },
      });
      if(signal.aborted){await worker.terminate().catch(()=>undefined);throw new DOMException('Cancelled','AbortError');}
      await worker.setParameters({tessedit_pageseg_mode:PSM.SPARSE_TEXT,preserve_interword_spaces:'0',user_defined_dpi:'150'});
      const {data}=await worker.recognize(input,{}, {text:true,blocks:true});
      if(signal.aborted)throw new DOMException('Cancelled','AbortError');
      const lines:OCRLine[]=[];
      for(const block of data.blocks||[])for(const paragraph of block.paragraphs)for(const line of paragraph.lines){
        const words=line.words.map(word=>({text:word.text,confidence:word.confidence,box:{x:word.bbox.x0,y:word.bbox.y0,width:word.bbox.x1-word.bbox.x0,height:word.bbox.y1-word.bbox.y0}}));
        lines.push({text:words.map(w=>w.text).join(' '),confidence:line.confidence,box:{x:line.bbox.x0,y:line.bbox.y0,width:line.bbox.x1-line.bbox.x0,height:line.bbox.y1-line.bbox.y0},words});
      }
      onProgress(98,'Connecting privacy evidence');
      return {text:data.text,confidence:data.confidence,lines,duration:performance.now()-started};
    })();
    const aborted=new Promise<never>((_,reject)=>{
      const rejectAbort=()=>reject(new DOMException('Cancelled','AbortError'));
      signal.addEventListener('abort',rejectAbort,{once:true});
      task.finally(()=>signal.removeEventListener('abort',rejectAbort)).catch(()=>undefined);
    });
    const timedOut=new Promise<never>((_,reject)=>{timeout=setTimeout(()=>{abort();reject(new Error('Local OCR took too long. Try a smaller, clearer image. Manual redaction is still available.'));},120000);});
    return await Promise.race([task,aborted,timedOut]);
  }finally{
    if(timeout)clearTimeout(timeout);
    signal.removeEventListener('abort',abort);
    await worker?.terminate().catch(()=>undefined);
  }
}
