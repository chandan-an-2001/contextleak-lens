import {describe,it,expect} from 'vitest';
import type {Finding,OCRResult,Redaction} from '../types';
import {detect,luhn,severityWeights} from './detection';
import {infer,score} from './inference';
import {clampBox,clientToImage,covered,inflate,normalizeBox,regionSignature} from '../lib/geometry';
import {historyPush} from '../hooks/useHistory';
import {createSafeReport} from './report';
import {validateFile} from './image';

function fixture(text:string):OCRResult{
 return {text,confidence:95,duration:10,lines:text.split('\n').map((line,i)=>{let x=10;return {text:line,confidence:95,box:{x:10,y:i*40,width:line.length*10,height:20},words:line.split(' ').map(t=>{const word={text:t,confidence:95,box:{x,y:i*40,width:t.length*10,height:20}};x+=t.length*10+10;return word;})};})};
}
const privateText='Name: Avery Example\nEmail: avery@studio.example.test\nAPI_KEY = sk_demo_000000000000000000000000\nLocal service: http://localhost:3000/admin';
const sample=()=>detect(fixture(privateText));
describe('Input validation',()=>{
 it('accepts supported screenshots',()=>{for(const type of ['image/png','image/jpeg','image/webp'])expect(()=>validateFile({type,size:50})).not.toThrow();});
 it('rejects unsupported and empty files',()=>{expect(()=>validateFile({type:'image/svg+xml',size:5})).toThrow();expect(()=>validateFile({type:'image/png',size:0})).toThrow();});
 it('rejects oversized images',()=>expect(()=>validateFile({type:'image/png',size:21*1024*1024})).toThrow('20 MB'));
});
describe('Meaningful privacy detection',()=>{
 it('detects email and correctly maps word coordinates',()=>{const f=detect(fixture('Email: avery@example.test')).find(f=>f.kind==='Email address');expect(f).toBeDefined();expect(f?.box.x).toBe(80);expect(f?.box.width).toBe(180);});
 it('recognizes fictional phone formats',()=>expect(detect(fixture('Phone: +1 (202) 555-0146')).some(f=>f.kind==='Phone number')).toBe(true));
 it('detects a labeled UPI candidate',()=>expect(detect(fixture('UPI: avery@okdemo')).some(f=>f.kind==='UPI payment identifier')).toBe(true));
 it('does not mistake emails for UPI identifiers',()=>expect(detect(fixture('Email: avery@example.test')).some(f=>f.kind==='UPI payment identifier')).toBe(false));
 it('detects secret patterns and masks panel values',()=>{const f=sample().find(f=>f.kind==='Potential API key');expect(f).toBeDefined();expect(f?.masked).not.toContain('sk_demo');});
 it('recognizes labeled names, internal services and domains',()=>{const names=sample().map(f=>f.kind);expect(names).toContain('Labeled name');expect(names).toContain('Internal network address');expect(names).toContain('Organization domain candidate');});
 it('handles Luhn and avoids arbitrary card-number claims',()=>{expect(luhn('4111 1111 1111 1111')).toBe(true);expect(luhn('1234567890123456')).toBe(false);expect(luhn('0000000000000000')).toBe(false);expect(detect(fixture('Card: 4111 1111 1111 1111')).some(f=>f.kind==='Card number candidate')).toBe(true);});
 it('does not treat build numbers or ISO dates as phone numbers',()=>{expect(detect(fixture('Build: 12345678\nDate: 2026-11-21 10:30')).some(f=>f.kind==='Phone number')).toBe(false);});
 it('detects labeled banking references without assuming validation',()=>{const f=detect(fixture('Bank account: 123456789012\nTransaction ID: DEMO-2026-001'));expect(f.some(f=>f.kind==='Account number candidate')).toBe(true);expect(f.some(f=>f.kind==='Transaction or order reference')).toBe(true);});
 it('detects sensitive query parameters',()=>expect(detect(fixture('https://example.test/join?token=DEMO_NONFUNCTIONAL_VALUE')).some(f=>f.kind==='Sensitive URL parameter')).toBe(true));
 it('keeps harmless content unflagged',()=>expect(detect(fixture('Welcome to the example project.\nThe build completed successfully.'))).toEqual([]));
});
describe('Contact names and date-aware phone detection',()=>{
 it.each([
  '+91 98765 43210','+1 (202) 555-0146','9876543210','020 7946 0958',
  '+44 20 7946 0958','+49 30 12345678','+33 1 23 45 67 89','2026111710',
 ])('keeps a plausible phone format: %s',text=>{
  const phones=detect(fixture(text)).filter(f=>f.kind==='Phone number');
  expect(phones.map(f=>f.sourceText)).toEqual([text]);
 });
 it.each([
  'Date: 17-11-2026 10:30','17.11.2026 14.30','11/17/2026 10:30',
  '2026-11-17T10:30:00Z','17 11 2026 10 30','17 November 2026 1030',
  'November 17, 2026 1030','Timestamp: 1794934055091','Date: 202611171030',
  'DOB: 171120261030','Account: 123456789012','Order ID: 123456789012',
  'IP: 192.168.100.100','Identifier: ABC123456789012','Phone: 0000000000',
 ])('does not report a date, identifier or address as a phone: %s',text=>{
  expect(detect(fixture(text)).filter(f=>f.kind==='Phone number')).toEqual([]);
 });
 it('keeps a real phone on the same row as a date and maps its original coordinates',()=>{
  const text='Date: 17-11-2026 10:30 Phone: +91 98765 43210';
  const phones=detect(fixture(text)).filter(f=>f.kind==='Phone number');
  expect(phones.map(f=>f.sourceText)).toEqual(['+91 98765 43210']);
  expect(phones[0].box.x).toBe(10+text.indexOf('+91')*10);
 });
 it.each(['Mom','Meera Rao',"José D’Souza",'R. Kumar','MEERA RAO'])('detects a labeled name: %s',name=>{
  expect(detect(fixture(`Name: ${name}`)).some(f=>f.kind==='Labeled name'&&f.sourceText===`Name: ${name}`)).toBe(true);
 });
 it('detects separate contact-name rows above numbers',()=>{
  const findings=detect(fixture('WhatsApp\nContacts\nAvery Example\n+1 (202) 555-0146\nMeera Rao\n+91 98765 43210'));
  expect(findings.filter(f=>f.kind==='Contact name candidate').map(f=>f.sourceText)).toEqual(['Avery Example','Meera Rao']);
  expect(findings.filter(f=>f.kind==='Phone number')).toHaveLength(2);
 });
 it('detects a single-word nickname and a lowercase contact label',()=>{
  const findings=detect(fixture('WhatsApp\nContacts\nMom\n+91 98765 43210\nravi\n+1 (202) 555-0146'));
  expect(findings.filter(f=>f.kind==='Contact name candidate').map(f=>f.sourceText)).toEqual(['Mom','ravi']);
 });
 it.each(['Meera Rao +91 98765 43210','+91 98765 43210 Meera Rao'])('separates a name and phone on one line: %s',text=>{
  const findings=detect(fixture(text));const name=findings.find(f=>f.kind==='Contact name candidate')!;
  expect(name.sourceText).toBe('Meera Rao');
  expect(name.box.x).toBe(10+text.indexOf('Meera')*10);expect(name.box.width).toBe(90);
  expect(name.masked).not.toContain('Meera');expect(name.explanation).toContain('candidate');
 });
 it('detects repeated contact names without phone numbers only in a contact-list layout',()=>{
  const findings=detect(fixture('WhatsApp\nSelect contact\n3 contacts\nMeera Rao\nMom\nR. Kumar'));
  expect(findings.filter(f=>f.kind==='Contact name candidate').map(f=>f.sourceText)).toEqual(['Meera Rao','Mom','R. Kumar']);
  expect(detect(fixture('Project overview\nMeera Rao\nAvery Example')).some(f=>f.kind==='Contact name candidate')).toBe(false);
 });
 it('does not turn interface labels, dates or ordinary instructions into names',()=>{
  const findings=detect(fixture('WhatsApp\nSelect contact\nNew group\nNew contact\nSearch\nToday\nYesterday\nOnline\n17 November 2026\nPlease call tomorrow\n+91 98765 43210'));
  expect(findings.filter(f=>f.kind==='Contact name candidate')).toEqual([]);
 });
 it('does not jump over an intervening label to associate a distant heading',()=>{
  expect(detect(fixture('Unrelated Heading\nMobile\n+91 98765 43210')).some(f=>f.kind==='Contact name candidate')).toBe(false);
 });
 it.each(['Purchase successful','Registration fee'])('does not classify a sentence fragment beside a phone as a name: %s',text=>{
  expect(detect(fixture(`${text}\n+91 98765 43210`)).some(f=>f.kind==='Contact name candidate')).toBe(false);
 });
 it('does not associate a name from a distant row or another column',()=>{
  const distant=fixture('Avery Example\n+91 98765 43210');distant.lines[0].box.y=-300;
  expect(detect(distant).some(f=>f.kind==='Contact name candidate')).toBe(false);
  const column=fixture('Avery Example\n+91 98765 43210');column.lines[0].box.x=900;
  for(const word of column.lines[0].words)word.box.x+=890;
  expect(detect(column).some(f=>f.kind==='Contact name candidate')).toBe(false);
 });
 it('keeps contact names and numbers out of exported reports',()=>{
  const findings=detect(fixture('Meera Rao +91 98765 43210'));
  const json=JSON.stringify(createSafeReport(findings,infer(findings),[],score(findings,infer(findings)),score(findings,infer(findings)),null));
  expect(json).toContain('Contact name candidate');expect(json).not.toContain('Meera Rao');expect(json).not.toContain('98765');
 });
});

describe('Explainable relationships and scoring',()=>{
 it('requires multiple real evidence references',()=>{const findings=sample(),connections=infer(findings);expect(connections.some(i=>i.id==='identity-work')).toBe(true);for(const inference of connections){expect(inference.evidence.length).toBeGreaterThan(1);for(const id of inference.evidence)expect(findings.some(f=>f.id===id)).toBe(true);expect(inference.explanation).toMatch(/may|could|potential/);}expect(infer([])).toEqual([]);});
 it('finds a schedule + meeting + identity connection',()=>expect(infer(detect(fixture('Name: Rowan Sample\nMeeting: https://meet.example.test/demo-room\nDate: 21 Nov 2026, 10:30 UTC'))).some(i=>i.id==='meeting-person')).toBe(true));
 it('calculates deterministic scores and caps at 100',()=>{const findings=sample();expect(score(findings,infer(findings))).toEqual(score(findings,infer(findings)));expect(score([],[]).value).toBe(0);expect(score(findings,infer(findings)).value).toBeLessThanOrEqual(100);expect(severityWeights.critical).toBe(25);});
 it('deduplicates same-category overlapping secrets',()=>{const f=sample().find(f=>f.kind==='Potential API key')!;expect(score([f,{...f,id:'duplicate',kind:'Labeled secret'}],[]).value).toBe(25);});
 it('removes unsupported relationships after evidence is covered',()=>{const findings=sample();const remaining=findings.filter(f=>f.kind!=='Email address');expect(infer(remaining).some(i=>i.id==='identity-work')).toBe(false);});
});
describe('Canonical coordinates and masks',()=>{
 it('transforms CSS points correctly at arbitrary zoom',()=>expect(clientToImage(160,110,{left:10,top:10,width:300,height:200},1200,800)).toEqual({x:600,y:400}));
 it('normalizes manual selections in either direction',()=>expect(normalizeBox({x:100,y:80},{x:20,y:10})).toEqual({x:20,y:10,width:80,height:70}));
 it('clamps moved and resized masks inside original pixels',()=>expect(clampBox({x:-4,y:90,width:200,height:50},100,100)).toEqual({x:0,y:90,width:100,height:10}));
 it('applies padding and requires complete coverage',()=>{const box={x:10,y:10,width:20,height:10};expect(inflate(box,6)).toEqual({x:4,y:4,width:32,height:22});expect(covered(box,[{id:'a',color:'#000000',box:{x:10,y:10,width:19,height:10}}])).toBe(false);expect(covered(box,[{id:'a',color:'#000000',box:inflate(box)}])).toBe(true);});
 it('recognizes coverage from the union of masks',()=>expect(covered({x:0,y:0,width:20,height:10},[{id:'a',color:'#000000',box:{x:0,y:0,width:12,height:10}},{id:'b',color:'#000000',box:{x:10,y:0,width:10,height:10}}])).toBe(true));
 it('undo/redo history preserves snapshots and truncates alternate futures',()=>{const r:Redaction={id:'x',color:'#000000',box:{x:1,y:2,width:30,height:20}};const first=historyPush({entries:[[]],index:0},[r]);r.box.x=900;expect(first.entries[1][0].box.x).toBe(1);const branch=historyPush({...first,index:0},[]);expect(branch.entries).toHaveLength(2);expect(branch.entries[1]).toEqual([]);});
 it('verification signature changes when a mask moves or changes color',()=>{const a:Redaction={id:'a',color:'#000000',box:{x:0,y:0,width:10,height:10}};expect(regionSignature([a])).not.toBe(regionSignature([{...a,color:'#ff0000'}]));});
});
describe('Safe report exports',()=>{
 it('omits original secrets and OCR source fields',()=>{const findings=sample();const report=createSafeReport(findings,infer(findings),[],score(findings,infer(findings)),score(findings,infer(findings)),null);const json=JSON.stringify(report);expect(json).not.toContain('avery@');expect(json).not.toContain('sk_demo_');expect(json).not.toContain('localhost:3000');expect(json).not.toContain('sourceText');expect(report.verification.status).toBe('Output has not been verified.');});
 it('reports coverage as an estimate and keeps manual review unresolved',()=>{const f:Finding={...sample()[0],reviewed:true};const report=createSafeReport([f],[],[],score([f],[]),score([f],[]),null);expect(report.findings[0].status).toBe('manually-reviewed-unresolved');});
});
