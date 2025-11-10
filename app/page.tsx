'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { UploadArea } from '@/components/UploadArea'
import { OptionsForm, type OptionsFormValues } from '@/components/OptionsForm'
import { PreviewCarousel } from '@/components/PreviewCarousel'
import { splitReviewIntoPagesPixel } from '@/lib/textSplit'
import { renderReviewImage, calculateReviewLayout } from '@/lib/canvasRender'
import type { CropValue } from '@/components/CropEditor'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

type PhotoItem = { id: string; file: File; url: string }

const LOGO_STORAGE_KEY = 'review-gen-logo'

// File을 base64로 변환
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// base64를 File 객체로 변환
function base64ToFile(base64: string, filename: string): File {
  const arr = base64.split(',')
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png'
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new File([u8arr], filename, { type: mime })
}

export default function Page() {
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [logo, setLogo] = useState<File | null>(null)
  const [saveDirectory, setSaveDirectory] = useState<FileSystemDirectoryHandle | null>(null)

  // 로고 불러오기 (페이지 로드 시)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOGO_STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        const file = base64ToFile(data.base64, data.filename)
        setLogo(file)
      }
    } catch (e) {
      console.error('로고 불러오기 실패:', e)
    }
  }, [])
  const [options, setOptions] = useState<OptionsFormValues>({
    storeName: '',
    location: '',
    date: '',
    review: '',
    fontFamily: 'NanumSquareRound',
    watermarkOpacity: 0.8,
    showWatermark: true,
    useLogo: true,
    logoWhite: true,
    autoFitToPhotos: true,
  })
  const [generating, setGenerating] = useState(false)
  const [previews, setPreviews] = useState<{ url: string; filename: string }[]>([])
  const [cropMap, setCropMap] = useState<Record<string, CropValue>>({})
  const previewsRef = useRef<{ url: string; filename: string }[]>([])
  previewsRef.current = previews

  const handleDrop = useCallback((accepted: File[]) => {
    const next = accepted.slice(0, 10)
      .filter(f => /\.(jpe?g|png)$/i.test(f.name))
      .map((file, idx) => ({ id: `${Date.now()}-${idx}-${file.name}`, file, url: URL.createObjectURL(file) }))
    setPhotos(prev => [...prev, ...next].slice(0, 10))
  }, [])

  const handleRemovePhoto = useCallback((id: string) => {
    setPhotos(prev => {
      const photo = prev.find(p => p.id === id)
      if (photo) {
        URL.revokeObjectURL(photo.url)
        // cropMap에서도 제거
        setCropMap(map => {
          const newMap = { ...map }
          delete newMap[id]
          return newMap
        })
      }
      return prev.filter(p => p.id !== id)
    })
  }, [])

  const handleDuplicatePhoto = useCallback((id: string) => {
    const original = photos.find(p => p.id === id)
    if (!original) return
    if (photos.length >= 10) {
      alert('사진은 최대 10장까지 추가할 수 있어요.')
      return
    }
    const newId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const newUrl = URL.createObjectURL(original.file)
    setPhotos(prev => [...prev, { id: newId, file: original.file, url: newUrl }])
    setCropMap(prev => {
      const existing = prev[id]
      if (!existing) return prev
      return {
        ...prev,
        [newId]: {
          ...existing,
          masks: existing.masks?.map(mask => ({ ...mask })),
        },
      }
    })
  }, [photos])

  const handleReorderPhotos = useCallback((fromIndex: number, toIndex: number) => {
    setPhotos(prev => {
      const newPhotos = [...prev]
      const [removed] = newPhotos.splice(fromIndex, 1)
      newPhotos.splice(toIndex, 0, removed)
      return newPhotos
    })
  }, [])

  const handleLogo = useCallback(async (files: File[]) => {
    const file = files[0] ?? null
    if (file) {
      try {
        // base64로 변환해서 localStorage에 저장
        const base64 = await fileToBase64(file)
        localStorage.setItem(LOGO_STORAGE_KEY, JSON.stringify({
          base64,
          filename: file.name,
        }))
        setLogo(file)
      } catch (e) {
        console.error('로고 저장 실패:', e)
        setLogo(file) // 저장 실패해도 일단 설정
      }
    } else {
      setLogo(null)
    }
  }, [])

  const handleRemoveLogo = useCallback(() => {
    localStorage.removeItem(LOGO_STORAGE_KEY)
    setLogo(null)
  }, [])

  const handleResetPhotos = useCallback(() => {
    // 사진 URL 메모리 해제
    photos.forEach(photo => URL.revokeObjectURL(photo.url))
    // preview URL 메모리 해제
    previewsRef.current.forEach(preview => URL.revokeObjectURL(preview.url))
    setPhotos([])
    setCropMap({})
    setPreviews([])
    // 상호명, 지역, 날짜, 리뷰 내용만 초기화 (나머지 설정은 유지)
    setOptions(prev => ({
      ...prev,
      storeName: '',
      location: '',
      date: '',
      review: '',
    }))
  }, [photos])

  const computed = useMemo(() => {
    const choose = (body: number) => {
      const m = calculateReviewLayout(options.fontFamily, body)
      const font = `normal ${m.bodyFontSize}px ${options.fontFamily}`
      const maxWidth = 1080 - m.paddingX * 2
      const reservedTop = m.paddingY + Math.max(m.nameFontSize, m.dateFontSize) + 14 + 18
      const reservedBottom = m.paddingY
      const available = m.overlayHeight - reservedTop - reservedBottom
      const maxLines = Math.max(1, Math.floor(available / m.lineHeight))
      const pages = splitReviewIntoPagesPixel(options.review, { maxLinesPerImage: maxLines, maxWidthPx: maxWidth, font })
      return { pages, m }
    }

    const target = options.autoFitToPhotos ? Math.max(1, photos.length) : undefined
    if (!target) return choose(52)

    // 큰 폰트부터 줄이면서 target 이내로 맞추기
    for (let size = 68; size >= 18; size -= 2) {
      const res = choose(size)
      if (res.pages.length <= target) return res
    }
    return choose(18)
  }, [options.review, options.fontFamily, options.autoFitToPhotos, photos.length])

  const reviewPages = computed.pages
  const chosenMetrics = computed.m

  const reviewPageCount = reviewPages.length

  const generateAll = useCallback(async () => {
    if (!photos.length) return
    setGenerating(true)
    try {
      // 이전 preview URL 메모리 해제
      previewsRef.current.forEach(preview => URL.revokeObjectURL(preview.url))
      
      const outputs: { url: string; filename: string }[] = []
      const logoEl = logo ? await fileToImage(logo) : null

      if (options.autoFitToPhotos) {
        // 모든 사진을 처리하되, 리뷰 페이지가 부족하면 빈 리뷰로 표시
        for (let i = 0; i < photos.length; i++) {
          const photo = photos[i]
          const imgEl = await fileToImage(photo.file)
          const lines = reviewPages[i] || [] // 리뷰 페이지가 없으면 빈 배열 (빈 리뷰 오버레이 표시)
          const crop = cropMap[photo.id]
          const blob = await renderReviewImage({
            baseImage: imgEl,
            logoImage: options.useLogo ? logoEl : null,
            storeName: options.storeName.trim(),
            location: options.location.trim(),
            date: options.date.trim(),
            reviewLines: lines,
            fontFamily: options.fontFamily,
            watermarkOpacity: options.watermarkOpacity,
            showWatermark: options.showWatermark,
            logoWhite: options.logoWhite,
            overrideBodyFontSize: chosenMetrics.bodyFontSize,
            // @ts-ignore - extended at runtime
            crop,
            masks: crop?.masks,
          })
          const url = URL.createObjectURL(blob)
          const safeLocation = options.location.replace(/\s+/g, '_') || 'location'
          const safeStore = options.storeName.replace(/\s+/g, '_') || 'store'
          const safeDate = options.date.replace(/\D/g, '') || 'date'
          const filename = `${safeLocation}_${safeStore}_${safeDate}_${i + 1}.png`
          outputs.push({ url, filename })
        }
      } else {
        for (const photo of photos) {
          const imgEl = await fileToImage(photo.file)
          for (let i = 0; i < reviewPages.length; i++) {
            const lines = reviewPages[i]
            const crop = cropMap[photo.id]
            const blob = await renderReviewImage({
              baseImage: imgEl,
              logoImage: options.useLogo ? logoEl : null,
              storeName: options.storeName.trim(),
              location: options.location.trim(),
              date: options.date.trim(),
              reviewLines: lines,
              fontFamily: options.fontFamily,
              watermarkOpacity: options.watermarkOpacity,
              showWatermark: options.showWatermark,
              logoWhite: options.logoWhite,
              overrideBodyFontSize: chosenMetrics.bodyFontSize,
              // @ts-ignore - extended at runtime
              crop,
              masks: crop?.masks,
            })
            const url = URL.createObjectURL(blob)
            const safeLocation = options.location.replace(/\s+/g, '_') || 'location'
            const safeStore = options.storeName.replace(/\s+/g, '_') || 'store'
            const safeDate = options.date.replace(/\D/g, '') || 'date'
            const filename = `${safeLocation}_${safeStore}_${safeDate}_${i + 1}.png`
            outputs.push({ url, filename })
          }
        }
      }
      setPreviews(outputs)
    } finally {
      setGenerating(false)
    }
  }, [photos, logo, options.storeName, options.location, options.date, options.fontFamily, options.watermarkOpacity, options.showWatermark, options.logoWhite, options.useLogo, options.autoFitToPhotos, reviewPages, chosenMetrics.bodyFontSize, cropMap])

  const handleSelectSaveDirectory = useCallback(async () => {
    if (!('showDirectoryPicker' in window)) {
      alert('이 브라우저는 저장 위치 선택을 지원하지 않습니다.\nChrome, Edge, Opera 등의 최신 브라우저를 사용해주세요.')
      return
    }

    try {
      const handle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
      })
      setSaveDirectory(handle)
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.error('디렉토리 선택 실패:', e)
        alert('저장 위치 선택에 실패했습니다.')
      }
    }
  }, [])

  const downloadPNG = useCallback(async (item: { url: string; filename: string }) => {
    if (saveDirectory) {
      try {
        const res = await fetch(item.url)
        const blob = await res.blob()
        const fileHandle = await saveDirectory.getFileHandle(item.filename, { create: true })
        const writable = await fileHandle.createWritable()
        await writable.write(blob)
        await writable.close()
      } catch (e) {
        console.error('파일 저장 실패:', e)
        alert('파일 저장에 실패했습니다. 기본 다운로드 폴더로 저장됩니다.')
        saveAs(item.url, item.filename)
      }
    } else {
      saveAs(item.url, item.filename)
    }
  }, [saveDirectory])

  const downloadAllPNG = useCallback(async () => {
    if (!previews.length) return
    
    // 각 PNG 파일을 순차적으로 다운로드
    for (let i = 0; i < previews.length; i++) {
      await downloadPNG(previews[i])
      // 브라우저가 다운로드를 처리할 시간을 주기 위해 약간의 지연
      if (i < previews.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }
  }, [previews, downloadPNG])

  const downloadZIP = useCallback(async () => {
    if (!previews.length) return
    const zip = new JSZip()
    const folder = zip.folder('images')!
    for (const p of previews) {
      const res = await fetch(p.url)
      const blob = await res.blob()
      folder.file(p.filename, blob)
    }
    const content = await zip.generateAsync({ type: 'blob' })
    
    if (saveDirectory) {
      try {
        const fileHandle = await saveDirectory.getFileHandle('reviews.zip', { create: true })
        const writable = await fileHandle.createWritable()
        await writable.write(content)
        await writable.close()
        alert('ZIP 파일이 선택한 폴더에 저장되었습니다!')
      } catch (e) {
        console.error('ZIP 저장 실패:', e)
        alert('ZIP 파일 저장에 실패했습니다. 기본 다운로드 폴더로 저장됩니다.')
        saveAs(content, 'reviews.zip')
      }
    } else {
      saveAs(content, 'reviews.zip')
    }
  }, [previews, saveDirectory])

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-dark">간판의 품격 리뷰 이미지 생성기</h1>
        <div className="text-sm text-dark/60">1080 × 1350 • 4:5 • 인스타 최적</div>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <UploadArea
            onDropPhotos={handleDrop}
            onDropLogo={handleLogo}
            photos={photos}
            logo={logo}
            onDuplicatePhoto={handleDuplicatePhoto}
            onChangeCrop={(id, v) => setCropMap(m => ({ ...m, [id]: v }))}
            getCrop={(id) => cropMap[id]}
            onResetPhotos={handleResetPhotos}
            onRemovePhoto={handleRemovePhoto}
            onReorderPhotos={handleReorderPhotos}
            onRemoveLogo={handleRemoveLogo}
          />
          <OptionsForm value={options} onChange={setOptions} reviewPageCount={reviewPageCount} hasLogo={!!logo} />
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-soft">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-semibold text-dark">저장 위치</div>
                <div className="text-xs text-dark/60 mt-1">
                  {saveDirectory ? (
                    <>✅ 저장 위치가 선택되었습니다 (새로고침 전까지 유지)</>
                  ) : (
                    <>기본 다운로드 폴더에 저장됩니다</>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={handleSelectSaveDirectory}
                className="text-sm px-4 py-2 rounded-lg bg-gray-100 text-dark hover:bg-gray-200 transition-colors"
              >
                {saveDirectory ? '위치 변경' : '위치 선택'}
              </button>
            </div>
            {saveDirectory && (
              <button
                type="button"
                onClick={() => setSaveDirectory(null)}
                className="text-xs text-red-600 hover:text-red-700"
              >
                기본 다운로드 폴더로 변경
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              className="bg-primary text-white px-5 py-3 rounded-xl shadow-soft disabled:opacity-50"
              onClick={generateAll}
              disabled={!photos.length || !options.storeName || !options.date || !options.review}
            >
              {generating ? '생성 중...' : '리뷰 이미지 생성'}
            </button>
            <button
              className="bg-white text-dark px-5 py-3 rounded-xl shadow-soft border border-gray-200 disabled:opacity-50"
              onClick={downloadZIP}
              disabled={!previews.length}
            >
              ZIP 다운로드
            </button>
          </div>
        </div>
        <div className="lg:col-span-1">
          <PreviewCarousel items={previews} onDownload={downloadPNG} onDownloadAll={downloadAllPNG} />
        </div>
      </section>
    </main>
  )
}

async function fileToImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = url
    await new Promise((res, rej) => {
      img.onload = () => res(null)
      img.onerror = rej
    })
    return img
  } finally {
    // do not revoke yet; used by canvas draw lifecycle
  }
}


