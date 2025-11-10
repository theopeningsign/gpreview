'use client'

import { useEffect } from 'react'

export type OptionsFormValues = {
  storeName: string
  location: string
  date: string
  review: string
  fontFamily: string
  watermarkOpacity: number // 0~1
  showWatermark: boolean
  useLogo: boolean
  logoWhite: boolean
  autoFitToPhotos: boolean
}

type Props = {
  value: OptionsFormValues
  onChange: (v: OptionsFormValues) => void
  reviewPageCount: number
  hasLogo?: boolean
}

export function OptionsForm({ value, onChange, reviewPageCount, hasLogo }: Props) {
  useEffect(() => {
    if (!value.date) {
      const now = new Date()
      const yyyy = now.getFullYear()
      const mm = `${now.getMonth() + 1}`.padStart(2, '0')
      const dd = `${now.getDate()}`.padStart(2, '0')
      onChange({ ...value, date: `${yyyy}.${mm}.${dd}` })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDateChange = (input: string) => {
    // 숫자만 추출
    const digits = input.replace(/\D/g, '')
    
    // 8자리 숫자면 자동으로 포맷팅 (예: 20250918 -> 2025.09.18)
    if (digits.length === 8) {
      const formatted = `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`
      onChange({ ...value, date: formatted })
    } else {
      onChange({ ...value, date: input })
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-soft space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-sm text-dark/70">고객명/상호</label>
          <input
            value={value.storeName}
            onChange={e => onChange({ ...value, storeName: e.target.value })}
            placeholder="씨밀락"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="text-sm text-dark/70">지역</label>
          <input
            value={value.location}
            onChange={e => onChange({ ...value, location: e.target.value })}
            placeholder="경기 화성시"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="text-sm text-dark/70">리뷰 날짜</label>
          <input
            value={value.date}
            onChange={e => handleDateChange(e.target.value)}
            placeholder="2024.02.13 또는 20240213"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>
      <div>
        <label className="text-sm text-dark/70">리뷰 내용</label>
        <textarea
          value={value.review}
          onChange={e => onChange({ ...value, review: e.target.value })}
          rows={6}
          placeholder="사장님과 직원분들 너무 친절하시고..."
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="text-xs text-dark/50 mt-1">자동 분할: 이미지당 최대 3줄 / 줄당 약 35자</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div>
          <label className="text-sm text-dark/70">폰트</label>
          <select
            value={value.fontFamily}
            onChange={e => onChange({ ...value, fontFamily: e.target.value })}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="Pretendard">Pretendard</option>
            <option value="Nanum Gothic">나눔고딕</option>
            <option value="NanumSquareRound">나눔스퀘어라운드</option>
            <option value="SUIT">SUIT</option>
            <option value="Noto Sans KR">Noto Sans KR</option>
            <option value="BM JUA">배민주아 (Bold)</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-dark/70">워터마크 표시</label>
          <div className="mt-3 flex items-center gap-2">
            <input
              id="showWatermark"
              type="checkbox"
              checked={value.showWatermark}
              onChange={e => onChange({ ...value, showWatermark: e.target.checked })}
            />
            <label htmlFor="showWatermark" className="text-sm text-dark/80">표시</label>
          </div>
        </div>
        <div>
          <label className="text-sm text-dark/70">워터마크에 로고 사용</label>
          <div className="mt-3 flex items-center gap-2">
            <input
              id="useLogo"
              type="checkbox"
              checked={value.useLogo}
              onChange={e => onChange({ ...value, useLogo: e.target.checked })}
              disabled={!hasLogo}
            />
            <label htmlFor="useLogo" className="text-sm text-dark/80">사용{!hasLogo ? ' (로고 없음)' : ''}</label>
          </div>
        </div>
        <div>
          <label className="text-sm text-dark/70">로고 색상</label>
          <div className="mt-3 flex items-center gap-2">
            <input
              id="logoWhite"
              type="checkbox"
              checked={value.logoWhite}
              onChange={e => onChange({ ...value, logoWhite: e.target.checked })}
              disabled={!hasLogo || !value.useLogo}
            />
            <label htmlFor="logoWhite" className="text-sm text-dark/80">흰색 실루엣으로 표시</label>
          </div>
        </div>
        <div>
          <label className="text-sm text-dark/70">사진 개수에 맞춰 자동 분할</label>
          <div className="mt-3 flex items-center gap-2">
            <input
              id="autoFitToPhotos"
              type="checkbox"
              checked={value.autoFitToPhotos}
              onChange={e => onChange({ ...value, autoFitToPhotos: e.target.checked })}
            />
            <label htmlFor="autoFitToPhotos" className="text-sm text-dark/80">ON</label>
          </div>
        </div>
        <div>
          <label className="text-sm text-dark/70">워터마크 투명도 (80% 권장)</label>
          <input
            type="range"
            min={0.3}
            max={1}
            step={0.05}
            value={value.watermarkOpacity}
            onChange={e => onChange({ ...value, watermarkOpacity: Number(e.target.value) })}
            className="mt-2 w-full"
          />
          <div className="text-xs text-dark/50">{Math.round(value.watermarkOpacity * 100)}%</div>
        </div>
        <div className="text-sm text-dark/70 md:col-span-4">
          생성 예상 이미지 수: <span className="font-semibold">{reviewPageCount}</span>
        </div>
      </div>
    </div>
  )
}


