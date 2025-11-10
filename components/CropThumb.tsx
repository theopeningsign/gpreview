'use client'

import { useEffect, useRef } from 'react'
import { drawCoverWithCrop, applyMaskEffects, type CropSource, type MaskRegion } from '@/lib/canvasRender'

type Props = {
  imageUrl: string
  crop: CropSource & { masks?: MaskRegion[] }
  width: number
  height: number
}

export function CropThumb({ imageUrl, crop, width, height }: Props) {
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
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, width, height)
      drawCoverWithCrop(ctx, img, { x: 0, y: 0, w: width, h: height }, crop)
      applyMaskEffects(ctx, width, height, crop.masks)
    }
    return () => { cancelled = true }
  }, [imageUrl, crop, width, height])

  return <canvas ref={ref} style={{ width, height }} />
}





