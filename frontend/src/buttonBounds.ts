import type { Box } from './mock'

// 좌표 오프셋 대신 원본 사진의 파란 버튼 연결 영역을 확인합니다.
// AI가 이미 고른 담기/결제하기 버튼에만 적용하며 다른 메뉴/결제 수단은 건드리지 않습니다.
export function snapBlueButton(pixels: Uint8ClampedArray, width: number, height: number, box: Box): Box {
  const [top, left, bottom, right] = box
  const cx = (left + right) / 2000 * width, cy = (top + bottom) / 2000 * height
  const bw = (right - left) / 1000 * width, bh = (bottom - top) / 1000 * height
  const radius = Math.max(bh * 3, height * 0.09)
  const x0 = Math.max(0, Math.floor(cx - bw * 1.2)), x1 = Math.min(width - 1, Math.ceil(cx + bw * 1.2))
  const y0 = Math.max(0, Math.floor(cy - radius)), y1 = Math.min(height - 1, Math.ceil(cy + radius))
  const seen = new Uint8Array(width * height)
  const blue = (i: number) => {
    const r = pixels[i * 4]!, g = pixels[i * 4 + 1]!, b = pixels[i * 4 + 2]!
    return b > 85 && b > r * 1.5 && b > g * 1.12 && b - r > 45
  }
  const regions: { bounds: Box; score: number }[] = []
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const start = y * width + x
    if (seen[start] || !blue(start)) continue
    const queue = [start]; seen[start] = 1
    let minX = x, maxX = x, minY = y, maxY = y
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q]!, px = i % width, py = Math.floor(i / width)
      minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, py); maxY = Math.max(maxY, py)
      for (const [nx, ny] of [[px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]]) {
        if (nx! < x0 || nx! > x1 || ny! < y0 || ny! > y1) continue
        const j = ny! * width + nx!
        if (!seen[j] && blue(j)) { seen[j] = 1; queue.push(j) }
      }
    }
    const w = maxX - minX + 1, h = maxY - minY + 1
    // ROI 경계에서 잘린 영역·글자 조각·다른 큰 패널은 버튼으로 확정하지 않습니다.
    if (minX <= x0 || maxX >= x1 || minY <= y0 || maxY >= y1 || w < width * 0.04 || h < height * 0.012 || h > height * 0.15 || w / h < 1.2 || w / h > 16 || queue.length / (w * h) < 0.55) continue
    const overlapX = Math.max(0, Math.min(maxX + 1, cx + bw / 2) - Math.max(minX, cx - bw / 2))
    if (overlapX / Math.min(w, bw) < 0.55 || cx < minX || cx > maxX) continue
    const dx = ((minX + maxX) / 2 - cx) / width, dy = ((minY + maxY) / 2 - cy) / height
    regions.push({ bounds: [minY / height * 1000, minX / width * 1000, (maxY + 1) / height * 1000, (maxX + 1) / width * 1000], score: Math.hypot(dx, dy) })
  }
  regions.sort((a, b) => a.score - b.score)
  if (!regions[0] || (regions[1] && regions[1].score - regions[0].score < 0.025)) return box
  return regions[0].bounds
}

export function refineButtonBounds(imageBase64: string, label: string, box: Box): Promise<Box> {
  if (!/결제하기|담기/.test(label)) return Promise.resolve(box)
  return new Promise(resolve => {
    const image = new Image()
    image.onerror = () => resolve(box)
    image.onload = () => {
      try {
        const scale = Math.min(1, 800 / Math.max(image.naturalWidth, image.naturalHeight))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(image.naturalWidth * scale); canvas.height = Math.round(image.naturalHeight * scale)
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return resolve(box)
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(snapBlueButton(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, box))
      } catch { resolve(box) }
    }
    image.src = `data:image/jpeg;base64,${imageBase64}`
  })
}
