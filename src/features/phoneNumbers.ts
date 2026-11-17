// Preserve character offsets while excluding recognizable calendar dates from
// phone matching. Phone-shaped text alone does not verify a working number.
const monthNumbers: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const monthPattern = 'Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?';

function calendarDate(year: number, month: number, day: number): boolean {
  if (year < 100) year += 2000;
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function phoneScanText(text: string): string {
  const spans: { start: number; end: number }[] = [];
  const exclude = (match: RegExpMatchArray) => {
    spans.push({ start: match.index!, end: match.index! + match[0].length });
  };
  for (const match of text.matchAll(/(?<!\d)(\d{4})([-/.])(\d{1,2})\2(\d{1,2})(?!\d)/g)) {
    if (calendarDate(+match[1], +match[3], +match[4])) exclude(match);
  }
  for (const match of text.matchAll(/(?<!\d)(\d{1,2})([-/.])(\d{1,2})\2(\d{4}|\d{2})(?!\d)/g)) {
    if (calendarDate(+match[4], +match[3], +match[1]) || calendarDate(+match[4], +match[1], +match[3])) exclude(match);
  }
  // A spaced day/month/year can otherwise merge with the adjacent clock time.
  for (const match of text.matchAll(/(?<!\d)(\d{1,2})[ \t]+(\d{1,2})[ \t]+(\d{4})(?!\d)/g)) {
    if (calendarDate(+match[3], +match[2], +match[1]) || calendarDate(+match[3], +match[1], +match[2])) exclude(match);
  }
  for (const match of text.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?[ \\t]+(${monthPattern})\\.?[ ,\\t]+(\\d{4})\\b`, 'gi'))) {
    if (calendarDate(+match[3], monthNumbers[match[2].slice(0, 3).toLowerCase()], +match[1])) exclude(match);
  }
  for (const match of text.matchAll(new RegExp(`\\b(${monthPattern})\\.?[ \\t]+(\\d{1,2})(?:st|nd|rd|th)?[ ,\\t]+(\\d{4})\\b`, 'gi'))) {
    if (calendarDate(+match[3], monthNumbers[match[1].slice(0, 3).toLowerCase()], +match[2])) exclude(match);
  }
  return text.split('').map((char, i) => spans.some(span => i >= span.start && i < span.end) ? '_' : char).join('');
}

export function isPhoneCandidate(value: string, line: string, index: number): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15 || /^(\d)\1+$/.test(digits)) return false;
  if (value.startsWith('+0')) return false;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value) && value.split('.').every(part => +part <= 255)) return false;

  // Use the label immediately before this value, rather than rejecting a whole
  // row that happens to contain both a date/account field and a genuine phone.
  const preceding = line.slice(0, index);
  const nonPhoneLabel = /\b(?:date(?: of birth)?|dob|born|dated|timestamp|time|scheduled|created(?: at)?|updated(?: at)?|last seen|account(?: number| no\.?)?|bank account|card(?: number)?|transaction(?: id)?|order(?: id)?|reference|invoice(?: number)?|utr|upi|amount|total|price|balance|quantity|build|version)\s*[:=#-]?\s*$/i;
  if (nonPhoneLabel.test(preceding)) return false;
  return true;
}
