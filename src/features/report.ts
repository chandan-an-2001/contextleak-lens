import type {Finding,Inference,Redaction,Score,Verification} from '../types';
import {covered} from '../lib/geometry';
export const limitations=[
  'Automated detection can miss private information or flag harmless text. Manually review every part of the image.',
  'English OCR is approximate; small, rotated, stylized, handwritten, or non-English text may be missed. Faces, barcodes, QR codes, and browser tabs without readable labels are not recognized automatically. Unlabeled names are checked only in supported contact or GitHub profile layouts and may be missed or misidentified. Profile photos always require manual review.',
  'Context links are deterministic possibilities, not verified identities, affiliations, attendance, fraud assessments, or probabilities.',
  'The score is a product-specific exposure estimate, not a security certification. Zero does not mean an image is safe.',
];
export function createSafeReport(findings:Finding[],inferences:Inference[],regions:Redaction[],before:Score,after:Score,verification:Verification|null){
  return {product:'ContextLeak Lens',version:1,createdAt:new Date().toISOString(),processing:'Local browser OCR and deterministic privacy rules. No model or cloud OCR.',
    summary:{findings:findings.length,redactionRegions:regions.length,coveredFindings:findings.filter(f=>covered(f.box,regions)).length,scoreBefore:before,estimatedScoreAfter:after},
    findings:findings.map(f=>({id:f.id,kind:f.kind,category:f.category,severity:f.severity,ocrConfidence:f.confidence,description:f.explanation,recommendation:f.recommendation,method:f.method,status:covered(f.box,regions)?'covered-estimate':f.reviewed?'manually-reviewed-unresolved':'unresolved'})),
    contextualInferences:inferences.map(i=>({title:i.title,evidence:i.evidence,explanation:i.explanation,recommendation:i.recommendation,confidence:i.confidence})),
    verification:verification?{remainingCount:verification.remaining.length,checkedAt:verification.checkedAt,score:verification.score,status:verification.remaining.length?'Remaining detections require review':'No additional exposures detected by this scan. Manual review is still recommended.'}:{status:'Output has not been verified.'},limitations};
}
