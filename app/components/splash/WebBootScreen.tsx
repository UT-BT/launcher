import { Loader2 } from 'lucide-react'
import logo from '@/app/assets/logo.png'
import { Button } from '@/app/components/ui/button'

interface WebBootScreenProps {
    error?: { message: string; retry: () => void } | null
}

export function WebBootScreen({ error }: WebBootScreenProps) {
    return (
        <div className="h-dvh flex flex-col items-center justify-center gap-4 bg-background text-foreground">
            <img src={logo} alt="UTBT Logo" className="size-20 object-contain" />
            {error ? (
                <div className="flex flex-col items-center gap-3 px-6 text-center">
                    <p className="text-sm text-muted-foreground max-w-sm">{error.message}</p>
                    <Button variant="outline" onClick={error.retry}>Retry</Button>
                </div>
            ) : (
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
            )}
        </div>
    )
}
