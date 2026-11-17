export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type Category = 'Identity' | 'Financial' | 'Credentials' | 'Network' | 'Context';
export interface Box { x: number; y: number; width: number; height: number }
export interface OCRWord { text: string; confidence: number; box: Box }
export interface OCRLine { text: string; confidence: number; box: Box; words: OCRWord[] }
export interface OCRResult { text: string; confidence: number; lines: OCRLine[]; duration: number }
export interface Finding {
  id: string; kind: string; category: Category; severity: Severity; confidence: number;
  box: Box; sourceText: string; masked: string; explanation: string; recommendation: string;
  method: string; reviewed?: boolean; relatedFindingIds?: string[];
}
export interface Inference {
  id: string; title: string; evidence: string[]; explanation: string; recommendation: string;
  confidence: 'moderate' | 'higher';
}
export interface Redaction { id: string; box: Box; color: string; findingId?: string }
export interface Score { value: number; findings: number; relationships: number; bySeverity: Record<Severity, number> }
export interface ScanImage { url: string; width: number; height: number; name: string; size: number; demo?: string }
export interface Verification { remaining: Finding[]; inferences: Inference[]; score: Score; checkedAt: string; duration: number; regionSignature: string }
export type View = 'overview' | 'studio' | 'report' | 'settings' | 'help';
export type Tool = 'select' | 'draw' | 'pan';
