import type { ScanImage } from '../types';
import { canvasBlob } from '../features/image';

export const demoOptions=[
  {id:'developer',title:'The developer workspace',subtitle:'A secret hiding in plain sight',type:'Developer',color:'violet',findings:'Credentials · account context'},
  {id:'meeting',title:'The meeting invitation',subtitle:'More than just a join link',type:'Meeting',color:'cyan',findings:'Identity · schedule · meeting'},
  {id:'offer',title:'The too-good-to-be-true offer',subtitle:'An identity meets a payment trail',type:'Conversation',color:'amber',findings:'Contact details · payment'},
] as const;
export type DemoId=typeof demoOptions[number]['id'];
export async function createDemo(id:DemoId):Promise<ScanImage>{
  const canvas=document.createElement('canvas');canvas.width=1440;canvas.height=960;
  const c=canvas.getContext('2d')!;
  c.fillStyle='#e9edf3';c.fillRect(0,0,1440,960);
  c.fillStyle='#fcfdff';c.fillRect(24,24,1392,912);
  c.fillStyle='#f0f2f7';c.fillRect(24,24,1392,70);
  ['#f07c7c','#e6bf64','#78c8a4'].forEach((color,i)=>{c.fillStyle=color;c.beginPath();c.arc(55+i*27,59,7,0,Math.PI*2);c.fill();});
  c.fillStyle='#64718b';c.font='20px Arial';c.fillText('FICTIONAL DEMO — all data is synthetic and nonfunctional',195,67);
  c.fillStyle='#f4f5fa';c.fillRect(24,94,240,842);
  c.fillStyle='#2c3552';c.font='bold 27px Arial';c.fillText(id==='developer'?'Codepad':id==='meeting'?'Gather':'Messages',52,151);
  c.font='21px Arial';c.fillStyle='#637087';['Workspace','Inbox','Projects','People','Settings'].forEach((s,i)=>c.fillText(s,52,219+i*57));
  c.fillStyle='#9b83ea';c.fillRect(24,192,4,40);
  c.fillStyle='#171e31';c.font='bold 33px Arial';
  const title=id==='developer'?'Project workspace / configuration':id==='meeting'?'Project catch-up / invitation':'Conversation / candidate onboarding';
  c.fillText(title,310,160);
  c.fillStyle='#74809a';c.font='21px Arial';c.fillText('Fictional example prepared for ContextLeak Lens',310,201);
  c.strokeStyle='#e5e8f1';c.beginPath();c.moveTo(310,232);c.lineTo(1360,232);c.stroke();
  const lines=id==='developer'?[
    'Name: Avery Example',
    'Email: avery@studio.example.test',
    '',
    'ENVIRONMENT CONFIGURATION',
    'API_KEY = sk_demo_000000000000000000000000',
    'Local service: http://localhost:3000/admin',
    'Account number: 123456789012',
    '',
    'Browser tab: Example Studio - account settings',
    'Note: sample values only. Not a real credential.',
  ]:id==='meeting'?[
    'Name: Rowan Sample',
    'Email: rowan@studio.example.test',
    '',
    'PROJECT PLANNING - EXAMPLE TEAM',
    'Meeting: https://meet.example.test/demo-room',
    'Date: 21 Nov 2026, 10:30 UTC',
    'Location: 42 Fictional Lane, Example City',
    '',
    'Please join using the invitation above.',
    'This event and every participant are fictional.',
  ]:[
    'Name: Avery Example',
    'Phone: +1 (202) 555-0146',
    'Email: hiring@example.test',
    '',
    'Your application has been shortlisted.',
    'Please send a refundable registration payment.',
    'UPI: avery@okdemo',
    'Transaction ID: DEMO-2026-001',
    '',
    'Fictional conversation. No payment can be made.',
  ];
  lines.forEach((line,i)=>{c.fillStyle=line===line.toUpperCase()&&line.length>0?'#798199':'#26324a';c.font=(id==='developer'&&i>=4&&i<=6?'25px monospace':'26px Arial');c.fillText(line,310,290+i*49);});
  c.fillStyle='#f0ebff';c.fillRect(310,838,1030,55);c.fillStyle='#7155b1';c.font='20px Arial';c.fillText('DEMO DATA ONLY  /  Processed through real local OCR — never pre-filled findings.',330,873);
  const blob=await canvasBlob(canvas);canvas.width=0;canvas.height=0;
  return {url:URL.createObjectURL(blob),width:1440,height:960,name:`demo-${id}.png`,size:blob.size,demo:id};
}
