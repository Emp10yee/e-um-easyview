import { Route, Routes } from 'react-router-dom'
import { GuidePage, StartPage } from './pages'

// 라우트 정의 (단순 페이지 이동만)
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<StartPage />} />
      <Route path="/guide" element={<GuidePage />} />
    </Routes>
  )
}
