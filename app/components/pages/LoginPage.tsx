import { useState } from 'react'
import { FaDiscord } from 'react-icons/fa'
import { useLogger } from '@/app/hooks/use-logger'

interface LoginPageProps {
    onLoginSuccess: () => void
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
    const logger = useLogger('LoginPage')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleLogin = async () => {
        setIsLoading(true)
        setError(null)
        try {
            logger.info('Initiating Discord login')
            await window.auth.login()
            logger.info('Login successful')
            onLoginSuccess()
        } catch (err) {
            logger.error('Login failed', err)
            setError('Failed to login with Discord. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="page-container flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
            <div className="nebula-bg" aria-hidden="true" />

            <div className="z-10 flex flex-col items-center gap-8 p-8 rounded-xl bg-card/50 backdrop-blur-sm border border-border shadow-2xl max-w-md w-full">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold tracking-tighter gradient-title">Welcome Back</h1>
                    <p className="text-muted-foreground">Sign in to access the UTBT Launcher</p>
                </div>

                {error && (
                    <div className="w-full p-3 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-md text-center">
                        {error}
                    </div>
                )}

                <button
                    onClick={handleLogin}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-3 px-6 py-3 text-white bg-[#5865F2] hover:bg-[#4752C4] active:bg-[#3C45A5] rounded-lg transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-[#5865F2]/25"
                >
                    {isLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <FaDiscord className="w-5 h-5" />
                    )}
                    <span>{isLoading ? 'Connecting...' : 'Login with Discord'}</span>
                </button>

                <div className="text-xs text-center text-muted-foreground">
                    By logging in, you agree to our Terms of Service and Privacy Policy.
                </div>
            </div>
        </div>
    )
}
