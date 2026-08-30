#!/usr/bin/env node
// Bu 3 kiem tra ma "no-restricted-syntax" cua @ds/_adherence.oxlintrc.json tung lam
// nhung oxlint khong ho tro rule nay (khong phai loi cau hinh, ban than oxlint chua
// implement "no-restricted-syntax"). 42/45 dieu kien con lai cua rule do la kiem tra
// prop component DS - da duoc TypeScript (.d.ts di kem moi component) bat tai bien
// dich, khong can lam lai o day. Chi 3 dieu kien nay la kiem tra NOI DUNG CHUOI ky tu
// (mau hex, gia tri px, font-family) ma TypeScript khong the bat, nen giu lai duoi
// dang script quet regex don gian. Muc do "warn" (khong lam build fail), giong dung
// severity goc cua rule trong @ds.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'

const SRC_DIR = join(import.meta.dirname, '..', 'src')

const CHECKS = [
  {
    name: 'raw-hex-color',
    pattern: /#[0-9a-fA-F]{3,8}\b/g,
    message: 'Raw hex color - use a design-system color token via var().',
  },
  {
    name: 'raw-px-value',
    pattern: /\b\d+px\b/g,
    message: 'Raw px value - use a design-system spacing token via var().',
  },
  {
    name: 'disallowed-font-family',
    pattern: /font-family\s*:\s*(?!['"]?(?:Be Vietnam Pro|JetBrains Mono))/gi,
    message: 'Font not provided by the design system. Available: Be Vietnam Pro, JetBrains Mono.',
  },
]

/** Liet ke de quy moi file .ts/.tsx duoi src/. */
function listSourceFiles(dir) {
  const files = []
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    if (statSync(fullPath).isDirectory()) {
      files.push(...listSourceFiles(fullPath))
    } else if (['.ts', '.tsx'].includes(extname(entry))) {
      files.push(fullPath)
    }
  }
  return files
}

let warningCount = 0

for (const file of listSourceFiles(SRC_DIR)) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return // bo qua dong comment don gian

    for (const check of CHECKS) {
      check.pattern.lastIndex = 0
      if (check.pattern.test(line)) {
        warningCount += 1
        console.warn(`${file}:${index + 1}  [${check.name}]  ${check.message}`)
      }
    }
  })
}

if (warningCount > 0) {
  console.warn(`\ncheck-design-tokens: ${warningCount} canh bao. Sua truoc khi bao hoan thanh man hinh.`)
} else {
  console.log('check-design-tokens: khong co canh bao.')
}
