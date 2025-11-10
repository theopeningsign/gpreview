'use client'

import { useEffect, useMemo, useState } from 'react'

type Item = { url: string; filename: string }

type Props = {
  items: Item[]
  onDownload: (item: Item) => void
  onDownloadAll?: () => void
}

export function PreviewCarousel({ items, onDownload, onDownloadAll }: Props) {
  const [index, setIndex] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [open, setOpen] = useState(false)
  const [zoomLarge, setZoomLarge] = useState(1)
  const total = items.length
  const current = items[index] || null

  const canPrev = index > 0
  const canNext = index < total - 1

  const pageLabel = useMemo(() => (total ? `${index + 1} / ${total}` : '미리보기 없음'), [index, total])

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-soft sticky top-6">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-dark/70">미리보기</div>
        <div className="text-xs text-dark/50">{pageLabel}</div>
      </div>
      <div className="aspect-[4/5] bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
        {current ? (
          <img
            src={current.url}
            alt={current.filename}
            className="object-contain cursor-zoom-in"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
            onClick={() => { setOpen(true); setZoomLarge(1.2) }}
          />
        ) : (
          <div className="text-sm text-dark/40">생성된 이미지가 여기 표시됩니다</div>
        )}
      </div>
      <div className="flex items-center justify-between mt-3 gap-2">
        <div className="flex gap-2">
          <button
            className="px-3 py-2 rounded-lg border border-gray-300 disabled:opacity-40"
            onClick={() => setIndex(n => Math.max(0, n - 1))}
            disabled={!canPrev}
          >
            이전
          </button>
          <button
            className="px-3 py-2 rounded-lg border border-gray-300 disabled:opacity-40"
            onClick={() => setIndex(n => Math.min(total - 1, n + 1))}
            disabled={!canNext}
          >
            다음
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input type="range" min={0.75} max={2} step={0.05} value={zoom} onChange={e => setZoom(Number(e.target.value))} />
          <span className="text-xs text-dark/50 w-10 text-right">{Math.round(zoom * 100)}%</span>
          <button
            className="px-3 py-2 rounded-lg bg-primary text-white disabled:opacity-40"
            onClick={() => current && onDownload(current)}
            disabled={!current}
          >
            PNG 다운로드
          </button>
        </div>
      </div>
      {items.length > 0 && onDownloadAll && (
        <button
          className="w-full mt-3 px-4 py-2 rounded-lg bg-primary text-white font-semibold disabled:opacity-40"
          onClick={onDownloadAll}
          disabled={items.length === 0}
        >
          전체 다운로드 ({items.length}장)
        </button>
      )}
      {open && current && (
        <Lightbox
          item={current}
          zoom={zoomLarge}
          onZoomChange={setZoomLarge}
          onClose={() => setOpen(false)}
        />)
      }
    </div>
  )
}

function Lightbox({ item, zoom, onZoomChange, onClose }: { item: Item; zoom: number; onZoomChange: (n: number) => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
      <div className="flex items-center justify-between p-3 text-white select-none">
        <div className="text-sm opacity-80 truncate">{item.filename}</div>
        <div className="flex items-center gap-3">
          <input type="range" min={0.5} max={3} step={0.05} value={zoom} onChange={e => onZoomChange(Number(e.target.value))} />
          <span className="text-sm w-12 text-right opacity-80">{Math.round(zoom * 100)}%</span>
          <button className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20" onClick={onClose}>닫기</button>
        </div>
      </div>
      <div className="flex-1 overflow-auto" onClick={onClose}>
        <div className="min-h-full w-full flex items-center justify-center p-6" onClick={e => e.stopPropagation()}>
          <img src={item.url} alt={item.filename} className="object-contain" style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }} />
        </div>
      </div>
    </div>
  )
}


