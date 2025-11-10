'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { CropEditor, type CropValue } from './CropEditor'
import { CropThumb } from './CropThumb'

type Props = {
  onDropPhotos: (files: File[]) => void
  onDropLogo: (files: File[]) => void
  photos: { id: string; file: File; url: string }[]
  logo: File | null
  onChangeCrop?: (id: string, v: CropValue) => void
  getCrop?: (id: string) => CropValue | undefined
  onResetPhotos?: () => void
  onRemovePhoto?: (id: string) => void
  onReorderPhotos?: (fromIndex: number, toIndex: number) => void
  onRemoveLogo?: () => void
  onDuplicatePhoto?: (id: string) => void
}

export function UploadArea({ onDropPhotos, onDropLogo, photos, logo, onChangeCrop, getCrop, onResetPhotos, onRemovePhoto, onReorderPhotos, onRemoveLogo, onDuplicatePhoto }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const onDropImages = useCallback((accepted: File[]) => {
    onDropPhotos(accepted)
  }, [onDropPhotos])

  const onDropLogoLocal = useCallback((accepted: File[]) => {
    onDropLogo(accepted)
  }, [onDropLogo])

  const imageDrop = useDropzone({ onDrop: onDropImages, accept: { 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'] }, multiple: true, maxFiles: 10 })
  const logoDrop = useDropzone({ onDrop: onDropLogoLocal, accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.svg'] }, multiple: false })

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div {...imageDrop.getRootProps()} className="md:col-span-2 bg-white border border-gray-200 rounded-xl p-5 text-center cursor-pointer shadow-soft relative">
        <input {...imageDrop.getInputProps()} />
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-dark font-semibold">사진 업로드 (최대 10장)</div>
            <div className="text-sm text-dark/60 mt-1">JPG/PNG, 드래그 앤 드롭 가능</div>
          </div>
          {photos.length > 0 && onResetPhotos && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                if (confirm('사진을 모두 삭제하시겠습니까? (상호명, 날짜, 리뷰 내용도 함께 삭제됩니다)')) {
                  onResetPhotos()
                }
              }}
              className="text-sm px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors border border-red-200"
            >
              사진 초기화
            </button>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2 mt-4">
          {photos.map((p, index) => (
            <div
              key={p.id}
              draggable={!!onReorderPhotos}
              onDragStart={(e) => {
                if (onReorderPhotos) {
                  setDraggedIndex(index)
                  e.dataTransfer.effectAllowed = 'move'
                }
              }}
              onDragOver={(e) => {
                if (onReorderPhotos && draggedIndex !== null && draggedIndex !== index) {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                }
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (onReorderPhotos && draggedIndex !== null && draggedIndex !== index) {
                  onReorderPhotos(draggedIndex, index)
                  setDraggedIndex(null)
                }
              }}
              onDragEnd={() => setDraggedIndex(null)}
              className={`aspect-[4/5] bg-gray-100 rounded-lg overflow-hidden relative group flex items-center justify-center ${
                draggedIndex === index ? 'opacity-50' : ''
              } ${onReorderPhotos ? 'cursor-move' : ''}`}
            >
              {getCrop && getCrop(p.id) ? (
                <CropThumb imageUrl={p.url} crop={getCrop(p.id)!} width={120} height={150} />
              ) : (
                <img src={p.url} className="max-w-full max-h-full object-contain" alt="uploaded" draggable={false} />
              )}
              {onRemovePhoto && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemovePhoto(p.id)
                  }}
                  className="absolute left-2 top-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 text-xs font-bold"
                  title="사진 삭제"
                >
                  ×
                </button>
              )}
              {onChangeCrop && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingId(p.id)
                  }}
                  className="absolute right-2 top-2 text-xs px-2 py-1 rounded-md bg-black/60 text-white opacity-0 group-hover:opacity-100"
                >
                  자르기
                </button>
              )}
              {onDuplicatePhoto && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDuplicatePhoto(p.id)
                  }}
                  className="absolute right-2 bottom-2 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-lg leading-none opacity-0 group-hover:opacity-100 transition-opacity shadow"
                  title="사진 복제"
                >
                  +
                </button>
              )}
              {onReorderPhotos && (
                <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-xs px-2 py-1 rounded-md bg-black/60 text-white opacity-0 group-hover:opacity-100 pointer-events-none">
                  드래그하여 순서 변경
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div {...logoDrop.getRootProps()} className="bg-white border border-gray-200 rounded-xl p-5 text-center cursor-pointer shadow-soft relative">
        <input {...logoDrop.getInputProps()} />
        <div className="text-dark font-semibold">로고 업로드 (선택)</div>
        <div className="text-sm text-dark/60 mt-1">PNG 권장, 투명 배경</div>
        <div className="mt-4 h-28 flex items-center justify-center bg-gray-50 rounded-lg relative group">
          {logo ? (
            <>
              <span className="text-sm text-dark/70">{logo.name}</span>
              {onRemoveLogo && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm('로고를 삭제하시겠습니까?')) {
                      onRemoveLogo()
                    }
                  }}
                  className="absolute right-2 top-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 text-xs font-bold"
                  title="로고 삭제"
                >
                  ×
                </button>
              )}
            </>
          ) : (
            <span className="text-sm text-dark/40">여기에 드롭하거나 클릭</span>
          )}
        </div>
        {logo && (
          <div className="text-xs text-dark/50 mt-2">
            💾 새로고침 후에도 유지됩니다
          </div>
        )}
      </div>
      {editingId && (
        <CropEditor
          open={true}
          imageUrl={photos.find(x => x.id === editingId)!.url}
          value={getCrop?.(editingId!) || { zoom: 1, offsetX: 0, offsetY: 0, masks: [] }}
          onChange={(v) => onChangeCrop && onChangeCrop(editingId!, v)}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  )
}


