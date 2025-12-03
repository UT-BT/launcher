import { BrowserWindow, shell } from 'electron'
import { getAuthConfig, setAuthConfig, clearAuthConfig, AuthConfig } from './config'
import { loggingService } from './logging-service'
import { createHash, randomBytes } from 'crypto'
import { createServer } from 'http'

const DISCORD_CLIENT_ID = '989441174022520842'

export class AuthService {
    private server: ReturnType<typeof createServer> | null = null

    async login(): Promise<AuthConfig> {
        loggingService.info('Starting Discord login flow', 'AuthService')

        if (this.server) {
            this.server.close()
            this.server = null
        }

        return new Promise((resolve, reject) => {
            const pkceState = this.generatePKCE()

            this.server = createServer(async (req, res) => {
                try {
                    const url = new URL(req.url!, `http://${req.headers.host}`)

                    if (url.pathname !== '/callback') {
                        res.writeHead(404)
                        res.end()
                        return
                    }

                    const code = url.searchParams.get('code')
                    const error = url.searchParams.get('error')

                    if (error) {
                        res.writeHead(400, { 'Content-Type': 'text/html' })
                        res.end('<h1>Login Failed</h1><p>You can close this window.</p>')
                        this.server?.close()
                        this.server = null
                        reject(new Error(`Discord auth error: ${error}`))
                        return
                    }

                    if (code) {
                        res.writeHead(200, { 'Content-Type': 'text/html' })
                        res.end('<h1>Login Successful</h1><p>You can close this window and return to the launcher.</p><script>window.close()</script>')
                        this.server?.close()
                        this.server = null

                        // Focus the app window
                        const wins = BrowserWindow.getAllWindows()
                        if (wins.length > 0) {
                            wins[0].show()
                            wins[0].focus()
                        }

                        try {
                            const { verifier } = pkceState
                            const redirectUri = `http://127.0.0.1:54321/callback`
                            const tokens = await this.exchangeCodeForToken(code, verifier, redirectUri)
                            const profile = await this.fetchUserProfile(tokens.access_token)

                            const authConfig: AuthConfig = {
                                discordId: profile.id,
                                username: profile.username,
                                avatar: profile.avatar,
                                accessToken: tokens.access_token,
                                refreshToken: tokens.refresh_token,
                                expiresAt: Date.now() + tokens.expires_in * 1000,
                            }

                            setAuthConfig(authConfig)
                            loggingService.info('Discord login successful', 'AuthService')
                            resolve(authConfig)
                        } catch (error) {
                            loggingService.error('Failed to exchange code or fetch profile', 'AuthService', error)
                            reject(error)
                        }
                    }
                } catch (err) {
                    loggingService.error('Error handling callback request', 'AuthService', err)
                    res.writeHead(500)
                    res.end()
                }
            })

            this.server.listen(54321, '127.0.0.1', () => {
                const redirectUri = `http://127.0.0.1:54321/callback`
                const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify&code_challenge=${pkceState.challenge}&code_challenge_method=S256`

                loggingService.info(`Opening auth URL: ${authUrl}`, 'AuthService')
                shell.openExternal(authUrl)
            })

            this.server.on('error', (err) => {
                this.server = null
                reject(err)
            })
        })
    }

    async logout(): Promise<void> {
        loggingService.info('Logging out', 'AuthService')
        clearAuthConfig()
    }

    getProfile(): AuthConfig | undefined {
        return getAuthConfig()
    }

    private generatePKCE() {
        const verifier = randomBytes(32).toString('base64url')
        const challenge = createHash('sha256').update(verifier).digest('base64url')
        return { verifier, challenge }
    }

    private async exchangeCodeForToken(code: string, verifier: string, redirectUri: string): Promise<any> {
        const params = new URLSearchParams()
        params.append('client_id', DISCORD_CLIENT_ID)
        params.append('grant_type', 'authorization_code')
        params.append('code', code)
        params.append('redirect_uri', redirectUri)
        params.append('code_verifier', verifier)

        const response = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            body: params,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        })

        if (!response.ok) {
            throw new Error(`Token exchange failed: ${response.statusText}`)
        }

        return response.json()
    }

    private async fetchUserProfile(accessToken: string): Promise<any> {
        const response = await fetch('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        })

        if (!response.ok) {
            throw new Error(`Profile fetch failed: ${response.statusText}`)
        }

        return response.json()
    }
}

export const authService = new AuthService()
