import type { Category, Finding, OCRLine, OCRResult, Severity } from '../types';
import { unionBox } from '../lib/geometry';
import { detectContactNames } from './contactNames';
import { isPhoneCandidate, phoneScanText } from './phoneNumbers';

export const severityWeights: Record<Severity,number>={critical:25,high:12,medium:6,low:2};
export const severityOrder: Severity[]=['critical','high','medium','low'];
export const categories: Category[]=['Identity','Financial','Credentials','Network','Context'];
type Rule={kind:string;category:Category;severity:Severity;pattern:RegExp;explanation:string;recommendation:string;validate?:(value:string,line:string,index:number)=>boolean};
export function luhn(value:string):boolean {
  const digits=value.replace(/\D/g,''); if(digits.length<13||digits.length>19||/^(\d)\1+$/.test(digits))return false;
  let sum=0,alternate=false;
  for(let i=digits.length-1;i>=0;i--){let n=Number(digits[i]);if(alternate){n*=2;if(n>9)n-=9;}sum+=n;alternate=!alternate;}
  return sum%10===0;
}
const rules:Rule[]=[
 {kind:'Email address',category:'Identity',severity:'high',pattern:/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,explanation:'A readable email address can reveal an account identity and a way to contact or target its owner.',recommendation:'Cover the complete email address, including the domain.'},
 {kind:'Phone number',category:'Identity',severity:'high',pattern:/(?<![\p{L}\p{N}_])(?:\+\d{1,3}[ .-]?)?(?:\(\d{2,4}\)[ .-]?)?\d[\d .-]{5,}\d(?![\p{L}\p{N}_])/gu,explanation:'A possible contact number may let someone connect this screenshot with a person or account. Recognizable calendar dates and explicit non-phone fields are excluded; the number is not verified.',recommendation:'Cover the complete number.',validate:isPhoneCandidate},
 {kind:'UPI payment identifier',category:'Financial',severity:'high',pattern:/\b[a-z0-9._-]{2,}@[a-z][a-z0-9]{1,}\b/gi,explanation:'A UPI-shaped payment identifier can associate a person with a payment account. This is a candidate, not bank verification.',recommendation:'Hide the payment identifier and related payment instructions.',validate:(v,line)=>!/\.[a-z]{2,}\b/i.test(line.slice(line.indexOf(v)+v.length))&&(/\bupi\b/i.test(line)||/@(?:okaxis|okhdfcbank|okicici|oksbi|ybl|ibl|axl|paytm|apl|upi)$/i.test(v))},
 {kind:'Card number candidate',category:'Financial',severity:'critical',pattern:/\b(?:\d[ -]?){12,18}\d\b/g,explanation:'This number has a card-like length and passes the Luhn checksum. That does not prove it is an active payment card.',recommendation:'Cover the entire number and any related expiry or security code.',validate:v=>luhn(v)},
 {kind:'Labeled name',category:'Identity',severity:'medium',pattern:/(?:\b(?:full name|name|participant|customer|recipient|from|candidate|account holder)\s*:\s*)([\p{L}][\p{L}\p{M}'’.-]*(?:[ \t]+[\p{L}][\p{L}\p{M}'’.-]*){0,4})/giu,explanation:'An explicit label suggests this text is a personal name. No identity lookup or facial recognition is performed.',recommendation:'Hide the name if the person should not be identified.'},
 {kind:'Date of birth candidate',category:'Identity',severity:'high',pattern:/\b(?:date of birth|dob|born)\s*:\s*[^\n]{4,32}/gi,explanation:'A birth-date label may expose personal information used for identification.',recommendation:'Cover the complete labeled birth date.'},
 {kind:'Potential API key',category:'Credentials',severity:'critical',pattern:/\b(?:sk[_-][a-zA-Z0-9_-]{12,}|AKIA[A-Z0-9]{16}|gh[pousr]_[a-zA-Z0-9]{20,}|AIza[a-zA-Z0-9_-]{25,})\b/g,explanation:'This value matches a common credential shape. Pattern matching cannot determine whether a credential is active.',recommendation:'Redact the full value. If a real credential has already been shared, revoke and rotate it.'},
 {kind:'Labeled secret',category:'Credentials',severity:'critical',pattern:/\b(?:password|passwd|api[_ -]?key|access[_ -]?token|auth[_ -]?token|secret|session[_ -]?(?:id|token))\s*[:=]\s*["']?([^\s"']{4,})/gi,explanation:'A credential-related label is followed by a visible value. Its validity has not been checked.',recommendation:'Cover both the value and related sensitive context. Rotate real exposed credentials.'},
 {kind:'Authentication token',category:'Credentials',severity:'critical',pattern:/\beyJ[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\b/g,explanation:'This value resembles a JSON Web Token and may contain session or account information.',recommendation:'Hide the entire token; invalidate real leaked sessions.'},
 {kind:'Sensitive URL parameter',category:'Credentials',severity:'critical',pattern:/https?:\/\/[^\s<>]+[?&](?:token|key|api_key|password|secret|auth|session|code)=[^\s<>]+/gi,explanation:'A URL contains a parameter often used to carry authentication or access information.',recommendation:'Cover the complete URL so the access value cannot be reconstructed.'},
 {kind:'Internal network address',category:'Network',severity:'medium',pattern:/\b(?:(?:https?:\/\/)?(?:localhost|127\.0\.0\.1|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})(?::\d{2,5})?(?:\/[^\s]*)?|https?:\/\/[^\s/]+\.(?:internal|local|corp)(?::\d+)?(?:\/[^\s]*)?)\b/gi,explanation:'An internal host or private address reveals infrastructure context; it does not by itself prove that a service is accessible.',recommendation:'Hide internal hostnames, paths, and port numbers.'},
 {kind:'Meeting link',category:'Context',severity:'high',pattern:/https?:\/\/(?:meet\.google\.com|[a-z0-9.-]*zoom\.us|teams\.microsoft\.com|meet\.[a-z0-9.-]+)[^\s<>]*/gi,explanation:'A meeting link may expose a room identifier or connect people with a particular event.',recommendation:'Hide the full meeting URL and any join code.'},
 {kind:'Address candidate',category:'Context',severity:'high',pattern:/\b(?:home address|shipping address|delivery address|address|location)\s*:\s*[^\n]{6,100}/gi,explanation:'A labeled address or location may reveal where someone lives, works, or receives deliveries. The location is not verified.',recommendation:'Cover the full location and nearby identifying details.'},
 {kind:'Account number candidate',category:'Financial',severity:'high',pattern:/\b(?:bank account|account no\.?|account number|a\/c)\s*[:=#-]?\s*\d[\d -]{7,23}\d/gi,explanation:'An account-related label is followed by a long number. No bank-account validation or lookup is performed.',recommendation:'Cover the full number and related account-holder information.'},
 {kind:'Transaction or order reference',category:'Financial',severity:'medium',pattern:/\b(?:transaction(?: id)?|txn(?: id)?|utr|order(?: id)?|reference)\s*[:=#-]\s*[A-Z0-9-]{5,30}/gi,explanation:'A transaction or order reference may link a screenshot to a purchase, payment, or support interaction.',recommendation:'Cover the reference when sharing outside the intended recipient.'},
 {kind:'Social handle',category:'Identity',severity:'medium',pattern:/(?:^|\s)@[a-zA-Z0-9_][a-zA-Z0-9_.]{2,29}\b/g,explanation:'A public handle can connect the screenshot with an online account.',recommendation:'Hide the handle if this account should remain unconnected.'},
 {kind:'Visible schedule',category:'Context',severity:'low',pattern:/\b(?:date|scheduled|meeting time|time|timestamp)\s*:\s*[^\n]{4,60}/gi,explanation:'A readable date or time may help connect a person with an event or activity.',recommendation:'Hide precise schedules when they contribute to unwanted context.'},
 {kind:'Browser title',category:'Context',severity:'low',pattern:/\b(?:browser tab|tab title|page title)\s*:\s*[^\n]{4,80}/gi,explanation:'A labeled browser title may reveal an activity, project, or organization.',recommendation:'Review browser chrome and crop or mask unrelated tabs.'},
];
export function maskValue(_value:string,kind:string):string {return kind==='Potential API key'||kind==='Labeled secret'||kind==='Authentication token'?'•••••••••••• (hidden)':'Sensitive value hidden';}
function matchBox(line:OCRLine,index:number,length:number){
  let cursor=0;const boxes=[];
  for(const word of line.words){const start=line.text.indexOf(word.text,cursor); if(start<0)continue; const end=start+word.text.length;if(end>index&&start<index+length)boxes.push(word.box);cursor=end;}
  return boxes.length?unionBox(boxes):line.box;
}
export function detect(result:OCRResult):Finding[]{
  const findings:Finding[]=[];
  for(const [li,line] of result.lines.entries()){
    for(const [ri,rule] of rules.entries()){
      rule.pattern.lastIndex=0;
      const scanText=rule.kind==='Phone number'?phoneScanText(line.text):line.text;
      for(const match of scanText.matchAll(rule.pattern)){
        const source=match[0].trim();
        const index=(match.index??0)+(match[0].length-match[0].trimStart().length);
        if(rule.validate&&!rule.validate(source,line.text,index))continue;
        findings.push({id:`f-${li}-${ri}-${match.index}`,kind:rule.kind,category:rule.category,severity:rule.severity,confidence:Math.round(line.confidence),box:matchBox(line,index,source.length),sourceText:source,masked:maskValue(source,rule.kind),explanation:rule.explanation,recommendation:rule.recommendation,method:rule.kind==='Card number candidate'?'Pattern + Luhn checksum':'Deterministic pattern + OCR coordinates'});
      }
    }
    const email=line.text.match(/@([a-z0-9.-]+\.[a-z]{2,})/i);
    if(email&&!/^(?:gmail|yahoo|outlook|hotmail|icloud|proton|protonmail)\.(?:com|in|net)$/i.test(email[1])){
      const domain=email[1];const at=line.text.indexOf(domain);
      findings.push({id:`f-${li}-domain`,kind:'Organization domain candidate',category:'Network',severity:'low',confidence:Math.round(line.confidence),box:matchBox(line,at,domain.length),sourceText:domain,masked:'Domain hidden',explanation:'A non-public-mail domain may connect an account to an organization. That affiliation is only a possibility.',recommendation:'Cover the email domain along with other identifying details.',method:'Email-domain relationship rule'});
    }
  }
  findings.push(...detectContactNames(result,findings,matchBox));
  // Suppress nested findings only within the same kind; different evidence stays explainable.
  return findings.filter((f,i,a)=>a.findIndex(g=>g.kind===f.kind&&g.sourceText===f.sourceText&&Math.abs(g.box.y-f.box.y)<3)===i).sort((a,b)=>severityOrder.indexOf(a.severity)-severityOrder.indexOf(b.severity));
}
