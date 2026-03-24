import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <p className="text-6xl font-bold text-muted-foreground">404</p>
      <p className="text-lg font-medium">Trang không tồn tại</p>
      <Link to="/" className="text-sm text-primary hover:underline">
        Về trang chủ
      </Link>
    </div>
  )
}
