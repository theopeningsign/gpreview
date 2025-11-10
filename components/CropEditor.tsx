'use client'

import { useEffect, useRef, useState } from 'react'
import { drawCoverWithCrop, applyMaskEffects, type MaskRegion } from '@/lib/canvasRender'

export type CropValue = {
  zoom: number // 0.5~3
  offsetX: number // -100~100 (% of extra area)
  offsetY: number // -200~200 (더 넓은 범위로 확장)
  masks?: MaskRegion[]
}

type Props = {
  open: boolean
  imageUrl: string
  value: CropValue
  onChange: (v: CropValue) => void
  onClose: () => void
}

export function CropEditor({ open, imageUrl, value, onChange, onClose }: Props) {
  const [local, setLocal] = useState<CropValue>(() => normalizeCropValue(value))
  useEffect(() => { if (open) setLocal(normalizeCropValue(value)) }, [open, value])

  const frameW = 432
  const frameH = 540
  const dragging = useRef<{x:number,y:number}|null>(null)
  const drawingMask = useRef<{x:number;y:number}|null>(null)
  const [draftMask, setDraftMask] = useState<MaskDraft | null>(null)
  const [tool, setTool] = useState<'pan' | 'mask'>('pan')
  const [hoveredMaskId, setHoveredMaskId] = useState<string | null>(null)
  const frameRef = useRef<HTMLDivElement | null>(null)

  function updateMask(id: string, updater: (draft: MaskRegion) => MaskRegion) {
    setLocal(prev => ({
      ...prev,
      masks: prev.masks ? prev.masks.map(mask => (mask.id === id ? updater({ ...mask }) : mask)) : prev.masks,
    }))
  }

  function removeMask(id: string) {
    setLocal(prev => ({
      ...prev,
      masks: prev.masks?.filter(mask => mask.id !== id),
    }))
  }

  function onDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    if (tool === 'mask') {
      e.preventDefault()
      const pos = getRelativePos(e, frameRef.current)
      if (!pos) return
      drawingMask.current = pos
      setDraftMask({ x: pos.x, y: pos.y, width: 0, height: 0 })
      return
    }
    dragging.current = { x: e.clientX, y: e.clientY }
  }
  function onMove(e: React.MouseEvent) {
    if (tool === 'mask') {
      if (!drawingMask.current) return
      const pos = getRelativePos(e, frameRef.current)
      if (!pos) return
      const draft = buildDraft(drawingMask.current, pos)
      setDraftMask(draft)
      return
    }
    if (!dragging.current) return
    const dx = e.clientX - dragging.current.x
    const dy = e.clientY - dragging.current.y
    dragging.current = { x: e.clientX, y: e.clientY }
    setLocal(prev => ({
      ...prev,
      offsetX: Math.max(-100, Math.min(100, prev.offsetX + (dx / frameW) * 100)),
      offsetY: Math.max(-200, Math.min(200, prev.offsetY + (dy / frameH) * 100)),
    }))
  }
  function onUp() {
    if (tool === 'mask') {
      if (drawingMask.current && draftMask) {
        if (draftMask.width > 0.01 && draftMask.height > 0.01) {
          const newMask: MaskRegion = {
            id: createMaskId(),
            type: 'pixelate',
            x: draftMask.x,
            y: draftMask.y,
            width: draftMask.width,
            height: draftMask.height,
            strength: 50,
          }
          setLocal(prev => ({
            ...prev,
            masks: [...(prev.masks ?? []), newMask],
          }))
        }
      }
      drawingMask.current = null
      setDraftMask(null)
      return
    }
    dragging.current = null
  }
  function onWheel(e: React.WheelEvent) {
    e.preventDefault()
    const delta = -e.deltaY / 1000
    setLocal(prev => ({ ...prev, zoom: Math.min(3, Math.max(0.5, prev.zoom + delta)) }))
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/70">
      <div className="absolute inset-0 flex flex-col">
          <div className="flex items-center justify-between p-3 text-white">
          <div className="text-sm opacity-80">사진 자르기 (4:5 비율)</div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20" onClick={onClose}>닫기</button>
            <button className="px-3 py-2 rounded-lg bg-primary" onClick={() => { onChange(local); onClose() }}>적용</button>
          </div>
        </div>
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
          <div className="flex items-center justify-center">
            <div
              ref={frameRef}
              className={`relative w-[432px] h-[540px] bg-black/40 rounded-lg overflow-hidden ${tool === 'mask' ? 'cursor-crosshair' : ''}`}
              onMouseDown={onDown}
              onMouseMove={onMove}
              onMouseUp={onUp}
              onMouseLeave={onUp}
              onWheel={onWheel}
            >
              {/* 캔버스 프리뷰: 최종 렌더와 동일 수식 */}
              <CanvasPreview imageUrl={imageUrl} zoom={local.zoom} offsetX={local.offsetX} offsetY={local.offsetY} masks={local.masks} />
              {local.masks?.map(mask => (
                <div
                  key={mask.id}
                  className={`absolute border ${hoveredMaskId === mask.id ? 'border-primary shadow-[0_0_0_2px_rgba(59,130,246,0.4)]' : 'border-white/70'}`}
                  style={{
                    left: `${mask.x * 100}%`,
                    top: `${mask.y * 100}%`,
                    width: `${mask.width * 100}%`,
                    height: `${mask.height * 100}%`,
                    pointerEvents: 'none',
                  }}
                >
                  <div className="absolute inset-0 bg-black/20" style={{ pointerEvents: 'none' }} />
                </div>
              ))}
              {draftMask && (
                <div
                  className="absolute border border-dashed border-white"
                  style={{
                    left: `${draftMask.x * 100}%`,
                    top: `${draftMask.y * 100}%`,
                    width: `${draftMask.width * 100}%`,
                    height: `${draftMask.height * 100}%`,
                    pointerEvents: 'none',
                  }}
                />
              )}
              <div className="absolute inset-0 ring-2 ring-white/60 pointer-events-none" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 space-y-4">
            <div>
              <div className="text-sm text-dark/70 mb-2">도구</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTool('pan')}
                  className={`px-3 py-2 rounded-md border ${tool === 'pan' ? 'bg-primary text-white border-primary' : 'bg-white text-dark border-gray-300 hover:bg-gray-100'}`}
                >
                  이동
                </button>
                <button
                  type="button"
                  onClick={() => setTool('mask')}
                  className={`px-3 py-2 rounded-md border ${tool === 'mask' ? 'bg-primary text-white border-primary' : 'bg-white text-dark border-gray-300 hover:bg-gray-100'}`}
                >
                  모자이크/블러 추가
                </button>
              </div>
              <div className="text-xs text-dark/50 mt-1">모자이크/블러 도구에서 영역을 드래그하면 추가됩니다.</div>
            </div>
            <div>
              <div className="text-sm text-dark/70">확대/축소</div>
              <input type="range" min={0.5} max={3} step={0.01} value={local.zoom} onChange={e => setLocal({ ...local, zoom: Number(e.target.value) })} className="w-full" />
            </div>
            <div>
              <div className="text-sm text-dark/70">가로 위치</div>
              <input type="range" min={-100} max={100} step={1} value={local.offsetX} onChange={e => setLocal({ ...local, offsetX: Number(e.target.value) })} className="w-full" />
            </div>
            <div>
              <div className="text-sm text-dark/70">세로 위치</div>
              <input type="range" min={-200} max={200} step={1} value={local.offsetY} onChange={e => setLocal({ ...local, offsetY: Number(e.target.value) })} className="w-full" />
              <div className="text-xs text-dark/50 mt-1">-200(위로) ~ 200(아래로)</div>
            </div>
            <div className="text-xs text-dark/50">Tip: 확대 후 위치를 미세조정하면 원하는 부분만 담을 수 있어요.</div>
            <div className="pt-2 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-dark/70">모자이크/블러 영역</div>
                {local.masks?.length ? (
                  <button
                    type="button"
                    className="text-xs text-red-500 hover:text-red-600"
                    onClick={() => setLocal(prev => ({ ...prev, masks: [] }))}
                  >
                    모두 삭제
                  </button>
                ) : null}
              </div>
              <div className="mt-3 space-y-3 max-h-48 overflow-auto">
                {local.masks?.length ? local.masks.map(mask => (
                  <div
                    key={mask.id}
                    className={`rounded-lg border p-3 space-y-3 ${hoveredMaskId === mask.id ? 'border-primary bg-primary/5' : 'border-gray-200'}`}
                    onMouseEnter={() => setHoveredMaskId(mask.id)}
                    onMouseLeave={() => setHoveredMaskId(null)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <select
                        value={mask.type}
                        onChange={e => updateMask(mask.id, draft => ({ ...draft, type: e.target.value as MaskRegion['type'] }))}
                        className="flex-1 rounded-md border-gray-300 px-2 py-1 text-sm"
                      >
                        <option value="pixelate">모자이크</option>
                        <option value="blur">블러</option>
                      </select>
                      <button
                        type="button"
                        className="text-xs text-red-500 hover:text-red-600"
                        onClick={() => removeMask(mask.id)}
                      >
                        삭제
                      </button>
                    </div>
                    <div>
                      <div className="text-xs text-dark/60 mb-1">
                        강도 <span className="ml-1 text-dark/70">{Math.round(mask.strength ?? 50)}</span>
                      </div>
                      <input
                        type="range"
                        min={10}
                        max={100}
                        step={1}
                        value={mask.strength ?? 50}
                        onChange={e => updateMask(mask.id, draft => ({ ...draft, strength: Number(e.target.value) }))}
                        className="w-full"
                      />
                    </div>
                  </div>
                )) : (
                  <div className="text-xs text-dark/50">추가된 영역이 없습니다. 모자이크/블러 도구를 이용해 영역을 지정해보세요.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CanvasPreview({ imageUrl, zoom, offsetX, offsetY, masks }: { imageUrl: string; zoom: number; offsetX: number; offsetY: number; masks?: MaskRegion[] }) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = imageUrl
    img.onload = () => {
      if (cancelled) return
      const w = 432, h = 540
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      drawCoverWithCrop(ctx, img, { x: 0, y: 0, w, h }, { zoom, offsetX, offsetY })
      applyMaskEffects(ctx, w, h, masks)
    }
    return () => { cancelled = true }
  }, [imageUrl, zoom, offsetX, offsetY, masks])
  return <canvas ref={ref} className="absolute inset-0" style={{ width: 432, height: 540 }} />
}

type MaskDraft = { x: number; y: number; width: number; height: number }

function normalizeCropValue(v: CropValue): CropValue {
  return {
    zoom: v?.zoom ?? 1,
    offsetX: v?.offsetX ?? 0,
    offsetY: v?.offsetY ?? 0,
    masks: (v?.masks ?? []).map(mask => ({ ...mask })),
  }
}

function buildDraft(start: { x: number; y: number }, current: { x: number; y: number }): MaskDraft {
  const left = Math.min(start.x, current.x)
  const top = Math.min(start.y, current.y)
  const width = Math.abs(current.x - start.x)
  const height = Math.abs(current.y - start.y)
  return { x: clamp01(left), y: clamp01(top), width: clamp01(width), height: clamp01(height) }
}

function getRelativePos(
  e: React.MouseEvent,
  el: HTMLDivElement | null,
) {
  if (!el) return null
  const rect = el.getBoundingClientRect()
  const width = rect.width || 1
  const height = rect.height || 1
  const x = ((e.clientX - rect.left) / width)
  const y = ((e.clientY - rect.top) / height)
  return { x: clamp01(x), y: clamp01(y) }
}

function clamp01(v: number) {
  if (!Number.isFinite(v)) return 0
  return Math.min(1, Math.max(0, v))
}

function createMaskId() {
  return `mask-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

