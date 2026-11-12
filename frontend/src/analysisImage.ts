// AI가 사진의 세로 위치를 추측하지 않도록 0~1000 좌표 눈금을 제공합니다.
// 분석용 복사본만 바꾸며, 사용자에게 보이는 사진과 좌표계·가로세로 크기는 같습니다.
export function addCoordinateGrid(imageBase64: string): Promise<string> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onerror = () => resolve(imageBase64)
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(imageBase64)
        const { width, height } = canvas
        ctx.drawImage(image, 0, 0)
        const fontSize = Math.max(10, Math.round(Math.max(width, height) * 0.014))
        ctx.font = `bold ${fontSize}px Arial`
        ctx.textBaseline = 'middle'
        // 가로·세로 모두 전체 이미지 기준 100 단위. 확대·크롭·여백 추가 없음.
        ctx.strokeStyle = 'rgba(255, 0, 255, 0.43)'
        ctx.lineWidth = Math.max(1, Math.max(width, height) / 800)
        for (let n = 100; n < 1000; n += 100) {
          const x = width * n / 1000, y = height * n / 1000
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke()
        }
        for (let n = 100; n < 1000; n += 100) {
          const x = width * n / 1000, y = height * n / 1000
          const label = String(n)
          const labelWidth = ctx.measureText(label).width + 8
          ctx.fillStyle = 'rgba(255, 255, 255, 0.94)'
          ctx.fillRect(0, y - fontSize * 0.65, labelWidth, fontSize * 1.3)
          ctx.fillRect(x - labelWidth / 2, 0, labelWidth, fontSize * 1.3)
          ctx.fillStyle = '#000000'
          ctx.fillText(label, 4, y)
          ctx.fillText(label, x - labelWidth / 2 + 4, fontSize * 0.65)
        }
        resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1] ?? imageBase64)
      } catch {
        resolve(imageBase64)
      }
    }
    image.src = `data:image/jpeg;base64,${imageBase64}`
  })
}
