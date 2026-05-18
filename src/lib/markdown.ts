/**
 * 마크다운 + frontmatter 헬퍼.
 * 본문(index.md) 과 사실레이어(geo-fact.md) 둘 다 frontmatter 를 가진다.
 */

import MarkdownIt from 'markdown-it';
import matter from 'gray-matter';

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  typographer: true
});

export interface ParsedMarkdown<T = Record<string, unknown>> {
  data: T;
  content: string;
  html: string;
}

export function parseMarkdown<T = Record<string, unknown>>(
  text: string
): ParsedMarkdown<T> {
  const fm = matter(text);
  return {
    data: fm.data as T,
    content: fm.content,
    html: md.render(fm.content)
  };
}

export function renderMarkdown(content: string): string {
  return md.render(content);
}

/**
 * geo-fact.md 의 GEO 린터.
 * 04_사실레이어_프롬프트.md 의 "이 단계가 끝났다고 볼 수 있는 조건" 을 자동 검사.
 */
export interface LinterFinding {
  level: 'error' | 'warn';
  rule: string;
  line: number;
  excerpt: string;
  hint?: string;
}

const FIRST_PERSON_PATTERNS = [/나는\b/, /내가\b/, /나의\b/, /우리는\b/, /우리가\b/];
const SUBJECTIVE_ADJECTIVES = [
  '아름다운',
  '환상적인',
  '최고의',
  '멋진',
  '훌륭한',
  '경이로운',
  '신비로운'
];

export function lintGeoFact(text: string): LinterFinding[] {
  const findings: LinterFinding[] = [];
  const lines = text.split(/\r?\n/);

  lines.forEach((line, i) => {
    const ln = i + 1;
    for (const pat of FIRST_PERSON_PATTERNS) {
      if (pat.test(line)) {
        findings.push({
          level: 'error',
          rule: '1인칭 표현 금지',
          line: ln,
          excerpt: line.trim(),
          hint: '사실레이어는 3인칭·백과사전적 톤만 허용.'
        });
        break;
      }
    }
    for (const adj of SUBJECTIVE_ADJECTIVES) {
      if (line.includes(adj)) {
        findings.push({
          level: 'error',
          rule: '주관 형용사 금지',
          line: ln,
          excerpt: line.trim(),
          hint: `"${adj}" 대신 검증 가능한 사실로 대체. (예: "정서향, 한강 폭 ~1.2km")`
        });
      }
    }

    // 단위 없는 숫자 (km/m/km/h/HH:MM 등이 모두 빠진 단순 숫자만 있는 줄) — 휴리스틱.
    // 좌표(소수점 5자리) 또는 마크다운 헤더 번호는 제외.
    if (
      /^\s*[-*]\s.+\d{2,}\s*$/.test(line) &&
      !/\b(km|m|km\/h|HH|MM|h|분|초|개소|m\/km)\b/.test(line) &&
      !/\(\s*-?\d+\.\d{4,5}\s*,\s*-?\d+\.\d{4,5}\s*\)/.test(line)
    ) {
      findings.push({
        level: 'warn',
        rule: '숫자에 단위 누락 가능성',
        line: ln,
        excerpt: line.trim(),
        hint: '모든 숫자에는 단위(km, m, km/h, h:mm, 개소 등) 표기.'
      });
    }
  });

  return findings;
}
