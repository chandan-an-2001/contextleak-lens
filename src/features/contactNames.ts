import type { Box, Finding, OCRLine, OCRResult } from '../types';

type TextBox = (line: OCRLine, start: number, length: number) => Box;
// Screen labels, common status text and sentence words are not name evidence.
const ignoredWords = new Set(('whatsapp contact contacts select search new chat chats group groups community communities ' +
  'call calls calling video message messages mobile phone telephone tel online offline typing last seen today yesterday tomorrow ' +
  'available busy status about settings linked devices invite friend friends info information media links docs starred blocked ' +
  'name number email date time january february march april may june july august september october november december ' +
  'jan feb mar apr jun jul aug sep oct nov dec monday tuesday wednesday thursday friday saturday sunday ' +
  'mon tue wed thu fri sat sun am pm utc gmt welcome build completed project meeting notes calendar ' +
  'the an is are was were this that these those please to from for with your our you me my at on in of and or ' +
  'hello hey using birthday work home add edit delete cancel done back').split(' '));

function nameSpan(line: OCRLine, start = 0, end = line.text.length, allowLowerCase = false) {
  const raw = line.text.slice(start, end);
  const leading = raw.match(/^[\s|•·:–—-]*(?:\d{1,3}[.)]\s+)?/u)![0].length;
  const text = raw.slice(leading).replace(/[\s|•·:–—-]+$/u, '');
  const words = text.split(/\s+/);
  if (!text || text.length > 80 || words.length > 5) return null;
  if (!words.every(word => /^[\p{L}][\p{L}\p{M}'’.-]*$/u.test(word))) return null;
  if (words.some(word => ignoredWords.has(word.toLowerCase().replace(/\.$/, '')))) return null;
  if (!words.some(word => word.replace(/[^\p{L}]/gu, '').length >= 2)) return null;
  // Outside a recognizable contact screen, do not treat sentence fragments
  // such as "Purchase successful" as a name just because a phone is nearby.
  if (!allowLowerCase && words.some((word, i) => {
    if (i > 0 && i < words.length - 1 && /^(?:de|da|del|di|dos|van|von|la)$/i.test(word)) return false;
    const first = Array.from(word)[0];
    return first !== first.toUpperCase();
  })) return null;
  return { text, index: start + leading };
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

export function detectContactNames(result: OCRResult, existing: Finding[], textBox: TextBox): Finding[] {
  const names: Finding[] = [];
  const phones = existing.filter(finding => finding.kind === 'Phone number');
  const texts = result.lines.map(line => line.text.trim());
  const selectContacts = texts.some(text => /^select(?: a)? contacts?(?:\s*\(\d+\))?$/i.test(text));
  const contactsHeading = texts.some(text => /^contacts?(?:\s*\(\d+\))?$/i.test(text));
  const contactCount = texts.some(text => /^\d+\s+contacts?$/i.test(text));
  const contactScreen = selectContacts || contactsHeading || /\bwhatsapp\b/i.test(result.text);
  const add = (line: OCRLine, lineIndex: number, start: number, end: number, method: string) => {
    const candidate = nameSpan(line, start, end, contactScreen);
    if (!candidate) return;
    const box = textBox(line, candidate.index, candidate.text.length);
    if ([...existing, ...names].some(finding => ['Labeled name', 'Contact name candidate'].includes(finding.kind) && overlaps(finding.box, box))) return;
    names.push({
      id: `f-${lineIndex}-contact-name-${candidate.index}`, kind: 'Contact name candidate', category: 'Identity', severity: 'medium',
      confidence: Math.round(line.confidence), box, sourceText: candidate.text, masked: 'Sensitive value hidden',
      explanation: 'The contact layout suggests this may be a display name, nickname, or organization label. It is a candidate, not a verified person or identity.',
      recommendation: 'Review this text and cover the complete name if the contact should not be identified.', method,
    });
  };

  for (const [lineIndex, line] of result.lines.entries()) {
    const linePhones = phones.filter(phone => line.text.includes(phone.sourceText) && overlaps(line.box, phone.box));
    for (const phone of linePhones) {
      const at = line.text.indexOf(phone.sourceText);
      add(line, lineIndex, 0, at, 'Name-shaped text beside a phone number + OCR coordinates');
      add(line, lineIndex, at + phone.sourceText.length, line.text.length, 'Name-shaped text beside a phone number + OCR coordinates');

      // Contact lists often put the name on the immediately preceding line.
      // Match the nearest aligned line so a distant heading or another column
      // cannot be chosen instead. Do not jump over an intervening status line.
      const nearby = result.lines.map((other, index) => ({ other, index, gap: phone.box.y - other.box.y - other.box.height }))
        .filter(({ other, index, gap }) => index !== lineIndex && gap >= -phone.box.height * .2 && gap <= Math.max(other.box.height, phone.box.height) * 2.4 &&
          Math.min(Math.abs(other.box.x - line.box.x), Math.abs(other.box.x - phone.box.x)) <= Math.max(other.box.height, phone.box.height) * 1.5)
        .sort((a, b) => a.gap - b.gap)[0];
      if (nearby) add(nearby.other, nearby.index, 0, nearby.other.text.length, 'Name-shaped text immediately above a phone number + OCR coordinates');
    }
  }

  // Names without a visible number need stronger screen context and repeated
  // row geometry. This is deliberately not a general proper-noun detector.
  if (selectContacts || (contactsHeading && (/\bwhatsapp\b/i.test(result.text) || contactCount))) {
    const rows = result.lines.map((line, index) => ({ line, index, candidate: nameSpan(line, 0, line.text.length, true) })).filter(row => row.candidate);
    for (const row of rows) {
      const aligned = rows.filter(other => other.index !== row.index &&
        Math.abs(other.line.box.x - row.line.box.x) <= row.line.box.height * 1.5 &&
        other.line.box.height >= row.line.box.height * .75 && other.line.box.height <= row.line.box.height * 1.33 &&
        Math.abs(other.line.box.y - row.line.box.y) >= Math.max(row.line.box.height, other.line.box.height));
      if (aligned.length) add(row.line, row.index, 0, row.line.text.length, 'Repeated name-shaped contact rows + contact-list heading + OCR coordinates');
    }
  }
  return names;
}
