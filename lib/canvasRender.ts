export type MaskRegion = {
  id: string
  type: 'pixelate' | 'blur'
  x: number // 0~1
  y: number // 0~1
  width: number // 0~1
  height: number // 0~1
  strength?: number // 0~100
}

export type RenderParams = {
  baseImage: HTMLImageElement
  logoImage: HTMLImageElement | null
  storeName: string
  location: string
  date: string
  reviewLines: string[] // 최대 3줄
  fontFamily: string
  watermarkOpacity: number // 0~1
  showWatermark: boolean
  logoWhite: boolean
  overrideBodyFontSize?: number
  masks?: MaskRegion[]
}

const WIDTH = 1080
const HEIGHT = 1350

export async function renderReviewImage(params: RenderParams): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')!

  // 배경
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // 사진 영역 전체(4:5 비 유지)
  const photoH = HEIGHT
  // 크롭 기반 cover 드로잉 (없으면 기본 contain)
  if ((params as any).crop) {
    drawCoverWithCrop(ctx, params.baseImage, { x: 0, y: 0, w: WIDTH, h: HEIGHT }, (params as any).crop)
  } else {
    // 자동으로 이미지 분석하여 아래쪽에 내용이 많으면 위로 조정
    const verticalShift = await detectVerticalShift(params.baseImage)
    drawContainImage(ctx, params.baseImage, { x: 0, y: 0, w: WIDTH, h: HEIGHT }, verticalShift)
  }

  // 마스크 처리 (모자이크/블러)
  applyMaskEffects(ctx, WIDTH, HEIGHT, params.masks)

  // 워터마크 우상단: 로고(30x30) + 텍스트(24px Bold, 흰색 80%, 그림자)
  if (params.showWatermark) {
    drawWatermark(ctx, params, { xRight: WIDTH - 30, yTop: 30 })
  }

  // 리뷰 오버레이: 사진 높이의 30%로 확대, 하단 가득 채우는 반투명 검정 배경 + 흰색 텍스트
  const metrics = calculateReviewLayout(params.fontFamily, params.overrideBodyFontSize)
  const overlayH = metrics.overlayHeight
  drawReviewOverlay(ctx, params, overlayH, metrics)

  return await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b!), 'image/png', 0.92)
  })
}

// 이미지의 수직 중심을 감지 (아래쪽에 내용이 많으면 음수 반환)
async function detectVerticalShift(img: HTMLImageElement): Promise<number> {
  const canvas = document.createElement('canvas')
  canvas.width = Math.min(img.naturalWidth, 200) // 성능을 위해 작은 크기로
  canvas.height = Math.min(img.naturalHeight, 200)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  
  // 상단 절반과 하단 절반의 평균 밝기 비교
  const midY = Math.floor(canvas.height / 2)
  let topBrightness = 0
  let bottomBrightness = 0
  let topCount = 0
  let bottomCount = 0
  
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const idx = (y * canvas.width + x) * 4
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]
      const brightness = (r + g + b) / 3
      
      if (y < midY) {
        topBrightness += brightness
        topCount++
      } else {
        bottomBrightness += brightness
        bottomCount++
      }
    }
  }
  
  const topAvg = topBrightness / topCount
  const bottomAvg = bottomBrightness / bottomCount
  
  // 하단이 상단보다 어둡고 (내용이 많고), 차이가 일정 이상이면 위로 이동
  // 차이를 정규화 (음수 = 위로 이동)
  const diff = topAvg - bottomAvg
  if (diff < -10) { // 하단이 더 어두움 (내용이 많음)
    // 최대 50%까지 위로 이동 (사진 크기 벗어나도 가능)
    return Math.max(-50, diff * 2.5)
  }
  
  return 0
}

function drawContainImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  rect: { x: number; y: number; w: number; h: number },
  verticalShift: number = 0 // 음수면 위로, 양수면 아래로 (퍼센트)
) {
  const iw = img.naturalWidth
  const ih = img.naturalHeight
  const ir = iw / ih
  const rr = rect.w / rect.h
  let dw = rect.w
  let dh = rect.h
  if (ir > rr) {
    // 이미지가 더 가로로 큼 → 높이 맞추고 좌우 여백
    dh = rect.h
    dw = dh * ir
  } else {
    // 이미지가 더 세로로 큼 → 가로 맞추고 상하 여백
    dw = rect.w
    dh = dw / ir
  }
  const dx = rect.x + (rect.w - dw) / 2
  let dy = rect.y + (rect.h - dh) / 2
  
  // verticalShift 적용
  // 상하 여백이 있을 때는 여백 기준으로, 없을 때는 이미지 높이 기준으로 이동
  if (rect.h > dh) {
    // 상하 여백이 있는 경우: 여백 기준으로 이동
    const extraSpace = rect.h - dh
    dy += (extraSpace * verticalShift) / 100
  } else {
    // 이미지가 영역보다 큰 경우: 이미지 높이 기준으로 이동 (제한 없음)
    dy += (dh * verticalShift) / 100
  }
  
  // 제한 제거: 이미지가 영역을 벗어나도 그릴 수 있도록 함
  ctx.drawImage(img, dx, dy, dw, dh)
}

export type CropSource = { zoom: number; offsetX: number; offsetY: number }

export function drawCoverWithCrop(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  rect: { x: number; y: number; w: number; h: number },
  crop?: CropSource
) {
  const iw = img.naturalWidth
  const ih = img.naturalHeight
  const targetRatio = rect.w / rect.h // 4:5
  // 소스에서 targetRatio 에 맞는 영역을 선택하고 zoom/offset 적용
  let sw: number, sh: number
  if (iw / ih > targetRatio) {
    // 더 가로로 김 → 높이에 맞춤
    sh = ih / (crop?.zoom || 1)
    sw = sh * targetRatio
  } else {
    sw = iw / (crop?.zoom || 1)
    sh = sw / targetRatio
  }
  let sx = (iw - sw) / 2
  let sy = (ih - sh) / 2
  // offset은 남는 여분 대비 퍼센트 이동
  const extraX = iw - sw
  const extraY = ih - sh
  if (crop) {
    // offsetX/Y: -100~100 => -100%~100%의 여유 공간 전체를 이동
    // 하지만 더 넓은 범위를 위해 추가 범위 허용
    sx += (extraX * crop.offsetX) / 100
    // offsetY가 -100보다 작거나 100보다 크면 이미지 높이 기준으로 추가 이동
    if (crop.offsetY < -100) {
      sy += (extraY * -100) / 100 + (ih * (crop.offsetY + 100)) / 100
    } else if (crop.offsetY > 100) {
      sy += (extraY * 100) / 100 + (ih * (crop.offsetY - 100)) / 100
    } else {
      sy += (extraY * crop.offsetY) / 100
    }
  }
  // 제한 완전 제거: 이미지가 원본 범위를 벗어나도 그릴 수 있도록
  // Canvas는 자동으로 클리핑하므로, 원본 이미지 밖의 영역은 투명하게 처리됨
  ctx.drawImage(img, sx, sy, sw, sh, rect.x, rect.y, rect.w, rect.h)
}

export function applyMaskEffects(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  masks?: MaskRegion[],
) {
  if (!masks?.length) return
  masks.forEach(mask => {
    if (mask.width <= 0 || mask.height <= 0) return
    const x = clamp(mask.x, 0, 1) * canvasWidth
    const y = clamp(mask.y, 0, 1) * canvasHeight
    const w = clamp(mask.width, 0, 1) * canvasWidth
    const h = clamp(mask.height, 0, 1) * canvasHeight
    if (w < 1 || h < 1) return
    if (mask.type === 'blur') {
      applyBlur(ctx, x, y, w, h, mask.strength)
    } else {
      applyPixelate(ctx, x, y, w, h, mask.strength)
    }
  })
}

function applyPixelate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  strength = 50,
) {
  const blockFactor = clamp(strength, 0, 100) / 100
  const baseBlock = Math.max(6, Math.round(blockFactor * 60))
  const stepsX = Math.max(1, Math.round(w / baseBlock))
  const stepsY = Math.max(1, Math.round(h / baseBlock))
  const off = document.createElement('canvas')
  off.width = stepsX
  off.height = stepsY
  const octx = off.getContext('2d')!
  octx.imageSmoothingEnabled = false
  octx.drawImage(ctx.canvas, x, y, w, h, 0, 0, stepsX, stepsY)
  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(off, 0, 0, stepsX, stepsY, x, y, w, h)
  ctx.restore()
}

function applyBlur(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  strength = 50,
) {
  const radius = Math.max(2, Math.round((clamp(strength, 0, 100) / 100) * 25))
  const off = document.createElement('canvas')
  off.width = w
  off.height = h
  const offCtx = off.getContext('2d')!
  offCtx.filter = `blur(${radius}px)`
  offCtx.drawImage(ctx.canvas, x, y, w, h, 0, 0, w, h)
  ctx.save()
  ctx.clearRect(x, y, w, h)
  ctx.drawImage(off, x, y)
  ctx.restore()
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function drawWatermark(
  ctx: CanvasRenderingContext2D,
  p: RenderParams,
  pos: { xRight: number; yTop: number }
) {
  const opacity = Math.max(0.5, Math.min(1, p.watermarkOpacity))
  const text = '간판의 품격'
  const fontBold = `bold 36px ${p.fontFamily}`
  ctx.save()
  ctx.font = fontBold
  ctx.textBaseline = 'top'
  const textWidth = ctx.measureText(text).width

  const logoSize = 45
  const gap = 5
  const totalWidth = (p.logoImage ? logoSize + gap : 0) + textWidth
  const x = pos.xRight - totalWidth
  const y = pos.yTop

  // 배경 Pill (반투명 검정)
  const padX = 10
  const padY = 6
  const pillW = totalWidth + padX * 2
  const pillH = Math.max(logoSize, 40) + padY * 2
  ctx.globalAlpha = 0.35
  ctx.fillStyle = '#000'
  roundRect(ctx, x - padX, y - padY, pillW, pillH, 12)
  ctx.fill()

  // 내용(로고+텍스트)
  ctx.globalAlpha = opacity
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = 3
  ctx.fillStyle = '#FFFFFF'
  if (p.logoImage) {
    if (p.logoWhite) {
      drawWhiteSilhouette(ctx, p.logoImage, x, y, logoSize, logoSize)
      // 외곽선(아주 얇게)으로 대비 강화
      ctx.save()
      ctx.globalAlpha = opacity
      ctx.shadowBlur = 0
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'
      ctx.lineWidth = 0.5
      ctx.strokeRect(x, y, logoSize, logoSize)
      ctx.restore()
    } else {
      // 원본 로고 표시
      ctx.drawImage(p.logoImage, x, y, logoSize, logoSize)
    }
  }
  const tx = p.logoImage ? x + logoSize + gap : x
  const ty = y + 4 // 시각적 보정
  ctx.fillText(text, tx, ty)
  ctx.restore()
}

export type ReviewLayoutMetrics = {
  paddingX: number
  paddingY: number
  nameFontSize: number
  dateFontSize: number
  bodyFontSize: number
  lineHeight: number
  overlayHeight: number
}

export function calculateReviewLayout(fontFamily: string, overrideBodySize?: number): ReviewLayoutMetrics {
  const overlayHeight = Math.round(HEIGHT * 0.30)
  const paddingX = 30
  const paddingY = 22
  const baseBody = overrideBodySize ?? 52
  const scale = baseBody / 52
  const nameFontSize = Math.round(56 * scale)
  const dateFontSize = Math.round(52 * scale * 0.6) // 0.6배로 축소
  const bodyFontSize = Math.round(baseBody)
  const lineHeight = Math.round(bodyFontSize * 1.5)
  return { paddingX, paddingY, nameFontSize, dateFontSize, bodyFontSize, lineHeight, overlayHeight }
}

function drawReviewOverlay(ctx: CanvasRenderingContext2D, p: RenderParams, overlayH: number, m: ReviewLayoutMetrics) {
  const y = HEIGHT - overlayH
  const { paddingX, paddingY } = m

  // 배경: 약간 투명한 검정
  ctx.save()
  ctx.globalAlpha = 0.9
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, y, WIDTH, overlayH)
  ctx.restore()

  // 공통 텍스트 스타일: 흰색 + 약간의 그림자
  ctx.fillStyle = '#FFFFFF'
  ctx.textBaseline = 'top'
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 3

  // 헤더: 상호 - 지역(크게) + 날짜(오른쪽)
  const { nameFontSize, dateFontSize } = m
  const headerY = y + paddingY
  
  // 날짜 너비 먼저 계산
  ctx.font = `normal ${dateFontSize}px ${p.fontFamily}`
  const dateText = p.date
  const dateWidth = ctx.measureText(dateText).width
  
  // 상호명과 지역 표시 (지역이 있으면 "상호 - 지역", 없으면 "상호")
  const nameText = p.location 
    ? `${p.storeName} - ${p.location}`
    : p.storeName
  
  // 사용 가능한 너비 계산 (날짜와 여유 공간 고려)
  const gap = 20 // 날짜와 상호명 사이 여유 공간
  const availableWidth = WIDTH - paddingX * 2 - dateWidth - gap
  
  // 폰트 크기를 조절하여 텍스트가 한 줄에 들어가도록
  let actualNameFontSize = nameFontSize
  ctx.font = `bold ${actualNameFontSize}px ${p.fontFamily}`
  let textWidth = ctx.measureText(nameText).width
  
  // 텍스트가 너무 길면 폰트 크기 줄이기 (최소 24px까지)
  while (textWidth > availableWidth && actualNameFontSize > 24) {
    actualNameFontSize -= 2
    ctx.font = `bold ${actualNameFontSize}px ${p.fontFamily}`
    textWidth = ctx.measureText(nameText).width
  }
  
  // 상호명 그리기
  ctx.fillText(nameText, paddingX, headerY)

  // 날짜 폰트 다시 설정 후 그리기
  // 날짜의 하단을 상호명의 하단과 맞추기 위해 Y 위치 조정
  // 상호명과 날짜의 폰트 크기 차이만큼 날짜를 아래로 이동
  const dateY = headerY + (actualNameFontSize - dateFontSize)
  ctx.font = `normal ${dateFontSize}px ${p.fontFamily}`
  ctx.fillText(dateText, WIDTH - paddingX - dateWidth, dateY)

  // 헤더 구분선 (얇은 흰색, 약간 투명)
  // 실제 사용된 폰트 크기로 계산 (날짜 폰트 크기와 비교)
  const lineY = headerY + Math.max(actualNameFontSize, dateFontSize) + 14
  ctx.save()
  ctx.globalAlpha = 0.5
  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(paddingX, lineY)
  ctx.lineTo(WIDTH - paddingX, lineY)
  ctx.stroke()
  ctx.restore()

  // 리뷰 본문: 더 크게, 흰색, 줄간격 1.6, 수직 중앙 정렬
  const { bodyFontSize, lineHeight } = m
  ctx.font = `normal ${bodyFontSize}px ${p.fontFamily}`
  const available = overlayH - (lineY - y) - m.paddingY
  const allowedLines = Math.max(1, Math.floor(available / lineHeight))
  const linesToRender = Math.min(allowedLines, p.reviewLines.length)
  const totalHeight = linesToRender > 0 ? (linesToRender - 1) * lineHeight + bodyFontSize : 0
  const offset = Math.max(8, (available - totalHeight) / 2)
  const startY = lineY + offset
  for (let i = 0; i < linesToRender; i++) {
    const ly = startY + i * lineHeight
    ctx.fillText(p.reviewLines[i], paddingX, ly)
  }
}

function drawWhiteSilhouette(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  // 1) 이미지 스케일링 후 픽셀 가져오기
  const off = document.createElement('canvas')
  off.width = w
  off.height = h
  const octx = off.getContext('2d')!
  octx.drawImage(img, 0, 0, w, h)

  // 2) 흰색(또는 거의 흰색) 배경 투명화
  const imgData = octx.getImageData(0, 0, w, h)
  const data = imgData.data
  const THR = 240 // 240 이상은 흰색으로 간주
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    // 완전 흰 배경 또는 밝은 회색 배경 제거
    if (r >= THR && g >= THR && b >= THR) {
      data[i + 3] = 0 // alpha 0
    }
  }
  octx.putImageData(imgData, 0, 0)

  // 3) 알파 영역만 흰색으로 칠함
  octx.globalCompositeOperation = 'source-in'
  octx.fillStyle = '#FFFFFF'
  octx.fillRect(0, 0, w, h)

  // 4) 메인 캔버스에 그리기
  ctx.drawImage(off, x, y)
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h / 2, w / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}


