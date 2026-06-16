import { useState, useEffect } from 'react'
import { FaDiscord } from 'react-icons/fa'
import { useLogger } from '@/app/hooks/use-logger'
import { Modal } from '@/app/components/ui/modal'
import { TERMS_OF_SERVICE, PRIVACY_POLICY } from '@/app/constants/legal'
import ReactMarkdown from 'react-markdown'

interface LoginPageProps {
    onLoginSuccess: () => void
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
    const logger = useLogger('LoginPage')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showTos, setShowTos] = useState(false)
    const [showPrivacy, setShowPrivacy] = useState(false)

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

    useEffect(() => {
        let timeoutId: NodeJS.Timeout

        if (isLoading) {
            timeoutId = setTimeout(() => {
                setIsLoading(false)
                setError('Login timed out. Please check your connection and try again.')
                logger.warn('Login timed out')
            }, 60000)
        }

        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId)
            }
        }
    }, [isLoading, logger])

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
                    className="w-full flex items-center justify-center gap-3 px-6 py-3 text-foreground bg-[#5865F2] hover:bg-[#4752C4] active:bg-[#3C45A5] rounded-lg transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-[#5865F2]/25"
                >
                    {isLoading ? (
                        <div className="w-5 h-5 border-2 border-hairline/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <FaDiscord className="w-5 h-5" />
                    )}
                    <span>{isLoading ? 'Connecting...' : 'Login with Discord'}</span>
                </button>

                <div className="text-xs text-center text-muted-foreground">
                    By logging in, you agree to our{' '}
                    <button
                        onClick={() => setShowTos(true)}
                        className="underline hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-sm"
                    >
                        Terms of Service
                    </button>
                    {' '}and{' '}
                    <button
                        onClick={() => setShowPrivacy(true)}
                        className="underline hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-sm"
                    >
                        Privacy Policy
                    </button>
                    .
                </div>
            </div>

            <Modal
                isOpen={showTos}
                onClose={() => setShowTos(false)}
                title="Terms of Service"
            >
                <div className="text-sm text-muted-foreground">
                    <ReactMarkdown
                        components={{
                            strong: ({ node: _node, ...props }) => <span className="font-bold text-foreground" {...props} />,
                            p: ({ node: _node, ...props }) => <p className="mb-4 last:mb-0 leading-relaxed" {...props} />,
                            ul: ({ node: _node, ...props }) => <ul className="list-disc pl-5 mb-4 space-y-1" {...props} />,
                            li: ({ node: _node, ...props }) => <li className="pl-1" {...props} />,
                        }}
                    >
                        {TERMS_OF_SERVICE}
                    </ReactMarkdown>
                </div>
            </Modal>

            <Modal
                isOpen={showPrivacy}
                onClose={() => setShowPrivacy(false)}
                title="Privacy Policy"
            >
                <div className="text-sm text-muted-foreground">
                    <ReactMarkdown
                        components={{
                            strong: ({ node: _node, ...props }) => <span className="font-bold text-foreground" {...props} />,
                            p: ({ node: _node, ...props }) => <p className="mb-4 last:mb-0 leading-relaxed" {...props} />,
                            ul: ({ node: _node, ...props }) => <ul className="list-disc pl-5 mb-4 space-y-1" {...props} />,
                            li: ({ node: _node, ...props }) => <li className="pl-1" {...props} />,
                        }}
                    >
                        {PRIVACY_POLICY}
                    </ReactMarkdown>
                </div>
            </Modal>
        </div>
    )
}
