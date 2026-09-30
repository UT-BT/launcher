import { createRequire } from 'module'
import { pickCamWindow, type TopLevelWindow } from './cam-window-match'

export interface CamTitleTarget {
    pid: number
    title: string
}

export interface CamWindows {
    applyTitles: (targets: readonly CamTitleTarget[]) => Promise<Map<number, boolean>>
}

const WM_SETTEXT = 0x000c
const GW_OWNER = 4
const SMTO_ABORTIFHUNG = 0x0002
const SET_TITLE_TIMEOUT_MS = 1000
const TEXT_BUFFER_CHARS = 256

let loaded: Promise<CamWindows> | null = null

export function loadCamWindows(): Promise<CamWindows> {
    loaded ??= bindCamWindows()
    return loaded
}

async function bindCamWindows(): Promise<CamWindows> {
    if (process.platform !== 'win32') {
        throw new Error('Cam window titles need Windows')
    }
    const koffi = createRequire(__filename)('koffi') as typeof import('koffi')
    const user32 = koffi.load('user32.dll')
    koffi.pointer('CamHWND', koffi.opaque())
    koffi.proto('bool __stdcall CamEnumWindowsProc(CamHWND hwnd, intptr_t lParam)')
    const EnumWindows = user32.func('bool __stdcall EnumWindows(CamEnumWindowsProc *lpEnumFunc, intptr_t lParam)')
    const GetWindowThreadProcessId = user32.func('uint32_t __stdcall GetWindowThreadProcessId(CamHWND hWnd, _Out_ uint32_t *lpdwProcessId)')
    const IsWindowVisible = user32.func('bool __stdcall IsWindowVisible(CamHWND hWnd)')
    const GetWindow = user32.func('CamHWND __stdcall GetWindow(CamHWND hWnd, uint32_t uCmd)')
    const GetWindowTextW = user32.func('int __stdcall GetWindowTextW(CamHWND hWnd, _Out_ uint8_t *lpString, int nMaxCount)')
    const GetClassNameW = user32.func('int __stdcall GetClassNameW(CamHWND hWnd, _Out_ uint8_t *lpClassName, int nMaxCount)')
    const SendMessageTimeoutW = user32.func('intptr_t __stdcall SendMessageTimeoutW(CamHWND hWnd, uint32_t Msg, uintptr_t wParam, const char16_t *lParam, uint32_t fuFlags, uint32_t uTimeout, _Out_ uintptr_t *lpdwResult)')

    const readText = (read: (hwnd: unknown, buffer: Buffer, max: number) => number, hwnd: unknown): string => {
        const buffer = Buffer.alloc(TEXT_BUFFER_CHARS * 2)
        const length = read(hwnd, buffer, TEXT_BUFFER_CHARS)
        return length > 0 ? buffer.toString('utf16le', 0, length * 2) : ''
    }

    const listWindows = (pids: ReadonlySet<number>): TopLevelWindow<unknown>[] => {
        const windows: TopLevelWindow<unknown>[] = []
        EnumWindows((hwnd: unknown) => {
            const pid = [0]
            GetWindowThreadProcessId(hwnd, pid)
            if (pids.has(pid[0])) {
                windows.push({
                    handle: hwnd,
                    pid: pid[0],
                    visible: IsWindowVisible(hwnd),
                    owned: GetWindow(hwnd, GW_OWNER) !== null,
                    title: readText(GetWindowTextW, hwnd),
                    className: readText(GetClassNameW, hwnd),
                })
            }
            return true
        }, 0)
        return windows
    }

    const setTitle = (hwnd: unknown, title: string): Promise<boolean> =>
        new Promise(resolve => {
            SendMessageTimeoutW.async(hwnd, WM_SETTEXT, 0, title, SMTO_ABORTIFHUNG, SET_TITLE_TIMEOUT_MS, [0], (error: unknown, result: number) => {
                resolve(!error && result !== 0)
            })
        })

    return {
        applyTitles: async targets => {
            const windows = listWindows(new Set(targets.map(target => target.pid)))
            const results = new Map<number, boolean>()
            await Promise.all(targets.map(async target => {
                const window = pickCamWindow(windows, target.pid, target.title)
                if (!window) {
                    results.set(target.pid, false)
                    return
                }
                if (window.title !== target.title) await setTitle(window.handle, target.title)
                results.set(target.pid, readText(GetWindowTextW, window.handle) === target.title)
            }))
            return results
        },
    }
}
