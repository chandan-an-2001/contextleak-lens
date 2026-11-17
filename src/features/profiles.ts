import type { Box, Finding, OCRLine, OCRResult } from '../types';

type TextBox = (line: OCRLine, start: number, length: number) => Box;
const reserved = new Set(('login logout signup join new settings features pricing search issues pulls notifications orgs organizations ' +
  'marketplace collections topics trending explore enterprise sponsors about security contact site customer-stories events apps ' +
  'codespaces copilot discussions sessions').split(' '));
const profileLabels = new Set(('github overview repositories projects packages stars followers following follower follow profile edit ' +
  'your find repository public private readme license activity contributions contribution settings report block').split(' '));
const canonical = (text: string) => text.toLowerCase().replace(/\s*-\s*/g, '-').trim();
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const validHandle = (text: string) => /^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/i.test(text) && !reserved.has(text.toLowerCase());

function displayName(line: OCRLine): boolean {
  const text = line.text.trim();const words = text.split(/\s+/);
  return text.length <= 80 && words.length <= 5 && words.some(word => word.replace(/[^\p{L}]/gu, '').length > 1) &&
    words.every(word => /^[\p{L}][\p{L}\p{M}'\u2019.-]*$/u.test(word) && !profileLabels.has(word.toLowerCase()));
}

export function detectProfiles(result: OCRResult, textBox: TextBox, prior: Finding[] = []): Finding[] {
  const found: Finding[] = [];
  const accounts = new Set(prior.filter(f => f.kind === 'Account handle').map(f => canonical(f.sourceText)).filter(validHandle));
  const add = (line: OCRLine, lineIndex: number, start: number, text: string, kind: string, method: string, relatedFindingIds?: string[]) => {
    const box = textBox(line, start, text.length);
    if (found.some(f => f.kind === kind && f.box.x === box.x && f.box.y === box.y)) return;
    found.push({
      id: `f-${lineIndex}-profile-${kind.replace(/\W+/g, '-').toLowerCase()}-${start}`,
      kind, category: 'Identity', severity: 'medium', confidence: Math.round(line.confidence), box, sourceText: text,
      masked: 'Sensitive value hidden', method, relatedFindingIds,
      explanation: kind === 'Account URL' ? 'This visible GitHub URL points to an account or an account-owned site. A public URL can still connect a screenshot to its owner.' :
        kind === 'Account handle' ? 'This text matches an account identifier supported by a visible GitHub URL or profile layout. No account lookup is performed.' :
        'The profile layout or a previously detected text match suggests a display name. This is a candidate, not a verified identity.',
      recommendation: kind === 'Account URL' ? 'Cover the full URL when the account should remain anonymous.' :
        kind === 'Account handle' ? 'Cover every visible occurrence, including those inside browser URLs and page headers.' :
        'Review and cover the display name. Review the profile photo separately and draw a mask if needed.',
    });
  };

  for (const [index, line] of result.lines.entries()) {
    const pattern = /(?<![\w.-])(?:https?:\/\/)?(?:www\.)?github\.com\/([a-z0-9]+(?:\s*-\s*[a-z0-9]+)*)(?:[/?#][^\s<>]*)?/gi;
    for (const match of line.text.matchAll(pattern)) {
      const account = canonical(match[1]);
      if (!validHandle(account)) continue;
      accounts.add(account);
      add(line, index, match.index!, match[0], 'Account URL', 'Visible GitHub account URL + OCR coordinates');
    }
    for (const match of line.text.matchAll(/(?<![\w.-])(?:https?:\/\/)?([a-z0-9]+(?:-[a-z0-9]+)*)\.github\.io(?:\/[^\s<>]*)?/gi)) {
      const account = canonical(match[1]);if (!validHandle(account)) continue;
      accounts.add(account);
      add(line, index, match.index!, match[0], 'Account URL', 'Account-owned GitHub Pages URL + OCR coordinates');
    }
  }

  const profileButtons = result.lines.filter(line => /^(?:edit\s*profile|follow|message)$/i.test(line.text.trim()));
  const profileScreen = (/\bgithub\b/i.test(result.text) || accounts.size > 0) &&
    (profileButtons.length > 0 || (/\brepositories\b/i.test(result.text) && /\bfollow(?:er|ers|ing)\b/i.test(result.text)));
  if (profileScreen) {
    // Fallback for a small or unreadable address bar: locate a standalone
    // account label close to a profile action, rather than guessing all titles.
    for (const line of result.lines) {
      const account = canonical(line.text);
      if (!validHandle(account) || !/[a-z]/i.test(account)) continue;
      const nearbyButton = profileButtons.some(button => {
        const gap = button.box.y - line.box.y - line.box.height;
        return gap >= 0 && gap <= Math.max(button.box.height, line.box.height) * 7 &&
          Math.abs(button.box.x - line.box.x) <= Math.max(button.box.height, line.box.height) * 8;
      });
      const nameAbove = result.lines.some(other => other !== line && displayName(other) &&
        other.box.y + other.box.height <= line.box.y && line.box.y - other.box.y - other.box.height <= Math.max(other.box.height, line.box.height) * 2.5 &&
        Math.abs(other.box.x - line.box.x) <= Math.max(other.box.height, line.box.height) * 1.5);
      if (nearbyButton && (nameAbove || /[-\d]/.test(account))) accounts.add(account);
    }
  }

  for (const account of accounts) {
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}_-])${account.split('-').map(escape).join('\\s*-\\s*')}(?![\\p{L}\\p{N}_-])`, 'giu');
    for (const [index, line] of result.lines.entries()) {
      for (const match of line.text.matchAll(pattern)) add(line, index, match.index!, match[0], 'Account handle', 'Account identifier matched across visible OCR regions');
    }
  }

  if (profileScreen) {
    for (const handle of found.filter(f => f.kind === 'Account handle')) {
      const lineIndex = result.lines.findIndex(line => line.text.includes(handle.sourceText) &&
        line.box.y <= handle.box.y && line.box.y + line.box.height >= handle.box.y + handle.box.height);
      if (lineIndex < 0) continue;
      const line = result.lines[lineIndex];const account = canonical(handle.sourceText);
      const evidence = found.filter(f => f.kind === 'Account handle' && canonical(f.sourceText) === account).map(f => f.id);
      const before = line.text.slice(0, line.text.indexOf(handle.sourceText)).trim();
      if (before && displayName({...line, text: before})) add(line, lineIndex, line.text.indexOf(before), before, 'Profile name candidate', 'Display name next to a profile account label + OCR coordinates', evidence);
      if (canonical(line.text) !== account) continue;
      const above = result.lines.map((other, index) => ({other, index, gap: line.box.y - other.box.y - other.box.height}))
        .filter(({other, index, gap}) => index !== lineIndex && gap >= 0 && gap <= Math.max(other.box.height, line.box.height) * 2.5 &&
          Math.abs(other.box.x - line.box.x) <= Math.max(other.box.height, line.box.height) * 1.5)
        .sort((a, b) => a.gap - b.gap)[0];
      if (above && displayName(above.other)) add(above.other, above.index, above.other.text.indexOf(above.other.text.trim()), above.other.text.trim(), 'Profile name candidate', 'Display name immediately above a profile account label + OCR coordinates', evidence);
    }
  }

  // Verification checks fresh OCR for identities found in the original scan,
  // even when redaction removes the URL/layout that first established context.
  for (const name of prior.filter(f => f.kind === 'Profile name candidate')) {
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])${name.sourceText.split(/\s+/).map(escape).join('\\s+')}(?![\\p{L}\\p{N}_])`, 'giu');
    for (const [index, line] of result.lines.entries()) {
      for (const match of line.text.matchAll(pattern)) add(line, index, match.index!, match[0], 'Profile name candidate', 'Previously detected display name matched in fresh OCR');
    }
  }
  return found;
}
