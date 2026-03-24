import { APP_CONFIG } from '@/constants/appConfig'

function App() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground">{APP_CONFIG.name}</h1>
        <p className="mt-2 text-muted-foreground">{APP_CONFIG.description}</p>
        <p className="mt-1 text-xs text-muted-foreground">v{APP_CONFIG.version}</p>
      </div>
    </div>
  )
}

export default App
