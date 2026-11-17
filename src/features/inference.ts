import type { Finding, Inference, Score } from '../types';
import { severityWeights } from './detection';

export function infer(findings:Finding[]):Inference[]{
  const result:Inference[]=[];
  const kinds=(...names:string[])=>findings.filter(f=>names.includes(f.kind));
  const add=(id:string,title:string,groups:Finding[][],explanation:string,recommendation:string)=>{
    if(groups.every(g=>g.length))result.push({id,title,evidence:[...new Set(groups.flat().map(f=>f.id))],explanation,recommendation,confidence:groups.flat().every(f=>f.confidence>=80)?'higher':'moderate'});
  };
  add('identity-work','An identity, connected to a workplace',[kinds('Labeled name'),kinds('Email address'),kinds('Organization domain candidate')],
    'A labeled name, an email, and an organization-shaped domain appear together. Someone may associate this person with a workplace account; the connection is not verified.',
    'Redact the name and complete email address to break this possible connection.');
  add('meeting-person','A person, a meeting, a moment',[kinds('Meeting link'),kinds('Labeled name','Email address'),kinds('Visible schedule')],
    'A join link, identity details, and a schedule may connect a person to a particular meeting. This does not establish attendance or access.',
    'Hide the join link, attendee details, and precise schedule before sharing.');
  add('credential-context','A credential with a trail to its account',[kinds('Potential API key','Labeled secret','Authentication token'),kinds('Email address','Internal network address')],
    'A potential secret appears alongside account or infrastructure details. If the secret is real, this combination could help someone understand where it belongs.',
    'Redact both the credential and account context. Revoke real credentials that have already been shared.');
  add('payment-identity','A payment trail tied to a person',[kinds('UPI payment identifier','Card number candidate','Account number candidate','Transaction or order reference'),kinds('Labeled name','Phone number','Email address')],
    'Payment-related text and personal identifiers appear in the same image. These details may connect a financial interaction with a person; no transaction is verified.',
    'Cover payment references and contact information together.');
  add('location-identity','A location linked to an identity',[kinds('Address candidate'),kinds('Labeled name','Email address','Phone number')],
    'A labeled location and personal identifiers could allow someone to associate a person with a place. The address and relationship are unverified.',
    'Hide the full location and identifying details.');
  return result;
}
export function score(findings:Finding[],inferences:Inference[]):Score{
  const bySeverity={critical:0,high:0,medium:0,low:0};
  // Same-category overlapping evidence contributes once at its highest severity.
  const groups:Finding[]=[];
  for(const f of findings){bySeverity[f.severity]++; const existing=groups.findIndex(g=>g.category===f.category&&g.box.x<=f.box.x+f.box.width&&f.box.x<=g.box.x+g.box.width&&g.box.y<=f.box.y+f.box.height&&f.box.y<=g.box.y+g.box.height);
    if(existing===-1)groups.push(f);else if(severityWeights[f.severity]>severityWeights[groups[existing].severity])groups[existing]=f;
  }
  const points=groups.reduce((sum,f)=>sum+severityWeights[f.severity],0),relationships=inferences.length*8;
  return {value:Math.min(100,points+relationships),findings:points,relationships,bySeverity};
}
// An optional future provider must accept explicit consent. No model is used by this app.
export interface ContextProvider {name:string;analyze(findings:Finding[]):Promise<Inference[]>}
