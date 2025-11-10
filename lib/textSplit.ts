export type PixelSplitOptions = {
  maxLinesPerImage: number
  maxWidthPx: number
  font: string // e.g. "normal 26px Pretendard"
}

// 픽셀 폭 기반 줄바꿈: 사용자가 입력한 줄바꿈은 강제 유지, 공백/문장부호 우선, 없으면 강제 자름
export function splitReviewIntoPagesPixel(text: string, opts: PixelSplitOptions): string[][] {
  const raw = (text ?? '').replace(/\r\n?/g, '\n').trim()
  if (!raw) return []

  const ctx = getMeasureContext(opts.font)
  const paragraphs = raw.split(/\n+/) // 사용자가 넣은 줄바꿈은 단락으로 보존
  const allLines: string[] = []

  for (const para of paragraphs) {
    wrapParagraphToLinesByPixel(para.trim(), opts.maxWidthPx, ctx, allLines)
  }

  const pages: string[][] = []
  for (let i = 0; i < allLines.length; i += opts.maxLinesPerImage) {
    pages.push(allLines.slice(i, i + opts.maxLinesPerImage))
  }
  return pages
}

function getMeasureContext(font: string): CanvasRenderingContext2D {
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')!
  ctx.font = font
  return ctx
}

function wrapParagraphToLinesByPixel(
  text: string,
  maxWidth: number,
  ctx: CanvasRenderingContext2D,
  out: string[],
  depth: number = 0
) {
  if (!text) return
  // 무한 재귀 방지 (최대 1000번)
  if (depth > 1000) {
    // 강제로 한 줄로 처리
    out.push(text.trim())
    return
  }
  const tokens = tokenize(text)
  let line = ''
  let lastBreakIdx = -1
  let sinceBreak = ''

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    const next = line + t
    const w = ctx.measureText(next).width
    if (w <= maxWidth) {
      line = next
      if (/\s$|[\u3002\uFF01\uFF1F.!?,]$/.test(t)) {
        // 공백 또는 문장부호에서 끊을 후보 기억
        lastBreakIdx = i
        sinceBreak = ''
      } else {
        sinceBreak += t
      }
    } else {
      // 넘침 → 가장 가까운 후보에서 끊기, 후보가 없으면 강제 자르기
      if (lastBreakIdx >= 0) {
        const lineTokens = tokens.slice(0, lastBreakIdx + 1)
        const lineText = lineTokens.join('').trim()
        if (lineText) out.push(lineText)
        const rest = tokens.slice(lastBreakIdx + 1)
        const restText = rest.join('')
        // 남은 텍스트가 줄어들지 않으면 강제 처리
        if (restText === text || restText.length >= text.length) {
          // 진행이 없으면 강제로 한 글자씩 자르기
          let cut = line
          while (ctx.measureText(cut).width > maxWidth && cut.length > 0) {
            cut = cut.slice(0, -1)
          }
          if (cut.trim()) out.push(cut.trim())
          const remaining = next.slice(cut.length)
          if (remaining && remaining !== text) {
            return wrapParagraphToLinesByPixel(remaining, maxWidth, ctx, out, depth + 1)
          }
          return
        }
        return wrapParagraphToLinesByPixel(restText, maxWidth, ctx, out, depth + 1)
      } else {
        // 후보가 없으면 한 글자씩 줄이면서 맞추기
        let cut = line
        while (ctx.measureText(cut).width > maxWidth && cut.length > 0) {
          cut = cut.slice(0, -1)
        }
        if (cut.trim()) out.push(cut.trim())
        const remaining = next.slice(cut.length)
        // 남은 텍스트가 줄어들지 않으면 강제 처리
        if (!remaining || remaining === text || remaining.length >= text.length) {
          if (remaining && remaining.trim()) {
            out.push(remaining.trim())
          }
          return
        }
        return wrapParagraphToLinesByPixel(remaining, maxWidth, ctx, out, depth + 1)
      }
    }
  }
  if (line.trim()) out.push(line.trim())
}

function tokenize(text: string): string[] {
  // 공백을 보존하고, 한국어에서 자주 쓰는 문장부호를 토큰으로 취급
  const re = /(\s+|[\u3002\uFF01\uFF1F.!?,])/g
  const out: string[] = []
  let last = 0
  let m: RegExpExecArray | null
  let prevIndex = -1 // 무한 루프 방지
  while ((m = re.exec(text))) {
    // 0 길이 매치 또는 같은 위치 반복 방지
    if (m.index === prevIndex || m[0].length === 0) {
      break
    }
    prevIndex = m.index
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push(m[0])
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}


