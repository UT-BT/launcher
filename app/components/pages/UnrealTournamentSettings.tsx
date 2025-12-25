import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, User, Monitor, Keyboard, Download, Upload, Loader2, CheckCircle, XCircle, ChevronDown, ChevronUp, AlertTriangle, Music, Joystick } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Slider } from '@/app/components/ui/slider'
import { Tooltip } from '@/app/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface UnrealTournamentSettingsProps {
    onBack: () => void
}

interface BindCategory {
    name: string
    binds: { label: string; command: string; tooltip?: string }[]
}

const BIND_CATEGORIES: BindCategory[] = [
    {
        name: 'Essentials',
        binds: [
            { label: 'Fire', command: 'fire' },
            { label: 'Alt Fire', command: 'altfire' },
            { label: 'Move Forward', command: 'moveforward' },
            { label: 'Move Backward', command: 'movebackward' },
            { label: 'Move Left', command: 'strafeleft' },
            { label: 'Move Right', command: 'straferight' },
            { label: 'Jump', command: 'jump' },
            {
                label: 'Walk Jump',
                command: 'walking|jump',
                tooltip: 'Walk Jumps are a special bind in Unreal Tournament that let you jump with less height than a regular jump, which can be useful for gaining time on maps. If you have jumpboots, then walk jump will allow you to jump without using a boot jump.'
            },
            { label: 'Walk', command: 'walking' },
            { label: 'Crouch', command: 'duck' },
            { label: 'Suicide', command: 'suicide' },
        ]
    },
    {
        name: 'UTBT Specific Binds',
        binds: [
            { label: 'Open UTBT MapVote', command: 'mutate bdbmapvote votemenu' },
            { label: 'Open UTBT Settings', command: 'mutate bte' },
            { label: 'Dodge Forward', command: 'utbtforwarddodge', tooltip: 'Allows you to dodge forward with one button' },
            { label: 'Dodge Backward', command: 'utbtbackdodge', tooltip: 'Allows you to dodge backward with one button' },
            { label: 'Dodge Left', command: 'utbtleftdodge', tooltip: 'Allows you to dodge left with one button' },
            { label: 'Dodge Right', command: 'utbtrightdodge', tooltip: 'Allows you to dodge right with one button' },
        ]
    },
    {
        name: 'Game & Tools',
        binds: [
            { label: 'Set Checkpoint', command: 'mutate checkpoint', tooltip: 'Sets a checkpoint at your current location. You will respawn here if you die.' },
            { label: 'Remove Checkpoints', command: 'mutate nocheckpoint', tooltip: 'Removes all your checkpoints from the map.' },
            { label: 'Teleport Forward', command: 'mutate tp', tooltip: 'Teleports you forward in the map. This will set you on a checkpoint run.' },
            { label: 'Ghost', command: 'mutate ghost', tooltip: 'Allows you to ghost through maps. This will set you on a checkpoint run.' },
            { label: 'Fly', command: 'mutate fly', tooltip: 'Allows you to fly through maps. This will set you on a checkpoint run.' },
            { label: 'Walk', command: 'mutate walk', tooltip: 'Sets you back to a walking state.' },
        ]
    },
    {
        name: 'Interface',
        binds: [
            { label: 'Show/Hide Scoreboard', command: 'ShowScores' },
            { label: 'Show Network Info', command: 'stat net' },
            { label: 'Spectate Player', command: 'viewteam' },
            { label: 'Take Screenshot', command: 'sshot' },
        ]
    }
]

const gcd = (a: number, b: number): number => {
    return b === 0 ? a : gcd(b, a % b)
}

const getAvailableResolutions = (nativeWidth: number, nativeHeight: number): string[] => {
    const divisor = gcd(nativeWidth, nativeHeight)
    const aspectWidth = nativeWidth / divisor
    const aspectHeight = nativeHeight / divisor
    const resolutionsByAspectRatio: Record<string, string[]> = {
        // 16:9 (most common)
        '16:9': ['1280x720', '1366x768', '1600x900', '1920x1080', '2560x1440', '3840x2160'],
        // 16:10
        '16:10': ['1280x800', '1440x900', '1680x1050', '1920x1200', '2560x1600', '3840x2400'],
        // 4:3 (older monitors)
        '4:3': ['640x480', '800x600', '1024x768', '1280x960', '1600x1200', '2048x1536'],
        // 21:9 (ultrawide)
        '21:9': ['2560x1080', '3440x1440', '3840x1600', '5120x2160'],
        // 32:9 (super ultrawide)
        '32:9': ['3840x1080', '5120x1440'],
        // 5:4
        '5:4': ['1280x1024', '2560x2048'],
    }

    const aspectRatioKey = `${aspectWidth}:${aspectHeight}`
    let resolutions = resolutionsByAspectRatio[aspectRatioKey] || []

    if (resolutions.length === 0) {
        const baseResolutions = [720, 900, 1080, 1440, 2160]
        resolutions = baseResolutions
            .map(height => {
                const width = Math.round((height * aspectWidth) / aspectHeight)
                return `${width}x${height}`
            })
            .filter(res => {
                const [w, h] = res.split('x').map(Number)
                return w <= nativeWidth && h <= nativeHeight
            })
    }

    const filteredResolutions = resolutions.filter(res => {
        const [w, h] = res.split('x').map(Number)
        return w <= nativeWidth && h <= nativeHeight
    })

    return filteredResolutions
}

interface SettingsSectionProps {
    title: string
    icon: React.ReactNode
    children: React.ReactNode
    defaultOpen?: boolean
    headerAction?: React.ReactNode
    activeIconClassName?: string
}

function SettingsSection({ title, icon, children, defaultOpen = false, headerAction, activeIconClassName }: SettingsSectionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen)

    return (
        <div className="rounded-xl bg-card border border-border overflow-hidden">
            <div
                className="flex items-center justify-between p-6 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-4">
                    <div className={cn("p-3 rounded-lg transition-colors", activeIconClassName || (isOpen ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"))}>
                        {icon}
                    </div>
                    <h3 className="text-lg font-semibold">{title}</h3>
                </div>
                <div className="flex items-center gap-4">
                    {headerAction && (
                        <div onClick={e => e.stopPropagation()}>
                            {headerAction}
                        </div>
                    )}
                    {isOpen ? <ChevronUp className="size-5 text-muted-foreground" /> : <ChevronDown className="size-5 text-muted-foreground" />}
                </div>
            </div>

            {isOpen && (
                <div className="px-6 pb-6 animate-in slide-in-from-top-2 duration-200">
                    <div className="pt-6 border-t border-border">
                        {children}
                    </div>
                </div>
            )}
        </div>
    )
}

interface RenderDeviceSetting {
    key: string
    label: string
    type: 'boolean' | 'number' | 'select' | 'color'
    options?: { label: string; value: string | number }[]
    min?: number
    max?: number
    step?: number
    tooltip?: string
    section?: string // To group settings if needed, e.g. "Visuals", "Performance"
}

const RENDER_DEVICE_SETTINGS: Record<string, RenderDeviceSetting[]> = {
    'D3D9Drv.D3D9RenderDevice': [
        { key: 'SwapInterval', label: 'VSync', type: 'boolean', tooltip: 'Vertical Sync. Prevents screen tearing but may increase input lag.' },
        { key: 'UseAA', label: 'Anti-Aliasing', type: 'boolean', tooltip: 'Smoothens jagged edges.' },
        { key: 'NumAASamples', label: 'AA Samples', type: 'select', options: [{ label: '2x', value: 2 }, { label: '4x', value: 4 }, { label: '8x', value: 8 }, { label: '16x', value: 16 }], tooltip: 'Higher values smooth edges more but reduce performance.' },
        { key: 'UsePrecache', label: 'Precache', type: 'boolean', tooltip: 'Preloads textures and sounds to reduce stuttering during gameplay.' },
        { key: 'UseTrilinear', label: 'Trilinear Filtering', type: 'boolean', tooltip: 'Smoothens textures at a distance. Low performance cost.' },
        { key: 'MaxAnisotropy', label: 'Anisotropic Filtering', type: 'select', options: [{ label: 'Off', value: 0 }, { label: '2x', value: 2 }, { label: '4x', value: 4 }, { label: '8x', value: 8 }, { label: '16x', value: 16 }], tooltip: 'Makes textures look sharp at oblique angles.' },
        { key: 'Coronas', label: 'Coronas', type: 'boolean', tooltip: 'Draws a halo effect around light sources.' },
        { key: 'ShinySurfaces', label: 'Shiny Surfaces', type: 'boolean', tooltip: 'Enables environment mapping on shiny surfaces like floors and weapons.' },
        { key: 'VolumetricLighting', label: 'Volumetric Lighting', type: 'boolean', tooltip: 'Enables fog-like lighting effects.' },
        { key: 'HighDetailActors', label: 'High Detail Actors', type: 'boolean', tooltip: 'Uses higher quality models for players and weapons if available.' },
        { key: 'LODBias', label: 'LOD Bias', type: 'number', min: -10, max: 10, step: 0.1, tooltip: 'Adjusts texture sharpness. Negative values are sharper, positive are blurrier.' },
        { key: 'GammaCorrectScreenshots', label: 'Gamma Correct Screenshots', type: 'boolean', tooltip: 'Ensures screenshots match the brightness of the game.' },
        { key: 'OneXBlending', label: 'OneX Blending', type: 'boolean', tooltip: 'Adjusts brightness to match the classic Glide renderer look.' },
        { key: 'UseS3TC', label: 'Use S3TC', type: 'boolean', tooltip: 'Required for high-resolution compressed textures.' },
        { key: 'Use16BitTextures', label: 'Use 16-bit Textures', type: 'boolean', tooltip: 'Reduces VRAM usage but causes color banding. Not recommended.' },
        { key: 'Use565Textures', label: 'Use 565 Textures', type: 'boolean', tooltip: 'Alternative 16-bit format. Not recommended for modern hardware.' },
        { key: 'UsePureDevice', label: 'Use Pure Device', type: 'boolean', tooltip: 'Offloads geometry calculations to the GPU. Recommended.' },
        { key: 'UseTripleBuffering', label: 'Triple Buffering', type: 'boolean', tooltip: 'Smoother than VSync but adds slightly more input latency.' },
        { key: 'FrameRateLimit', label: 'Frame Rate Limit', type: 'number', min: 0, max: 1000, step: 1, tooltip: 'Limit the frame rate. 0 is unlimited.' },
    ],
    'D3D11Drv.D3D11RenderDevice': [
        { key: 'UseVSync', label: 'VSync', type: 'boolean', tooltip: 'Vertical Sync. Prevents screen tearing.' },
        { key: 'AntialiasMode', label: 'Anti-Aliasing Mode', type: 'select', options: [{ label: 'Off', value: 'None' }, { label: '2x MSAA', value: 'MSAA_2x' }, { label: '4x MSAA', value: 'MSAA_4x' }, { label: '8x MSAA', value: 'MSAA_8x' }], tooltip: 'Technique used to smooth jagged edges.' },
        { key: 'Bloom', label: 'Bloom', type: 'boolean', tooltip: 'Creates a glowing effect around bright light sources.' },
        { key: 'BloomAmount', label: 'Bloom Amount', type: 'number', min: 0, max: 255, step: 1, tooltip: 'Controls the strength of the bloom effect.' },
        { key: 'Hdr', label: 'HDR', type: 'boolean', tooltip: 'Enables wider color range and contrast on supported monitors.' },
        { key: 'LightMode', label: 'Light Mode', type: 'select', options: [{ label: 'Normal', value: 'Normal' }, { label: 'One X Blending', value: 'OneXBlending' }, { label: 'Brighter Actors', value: 'BrighterActors' }], tooltip: 'Controls how light maps and actor lighting are blended.' },
        { key: 'GammaMode', label: 'Gamma Mode', type: 'select', options: [{ label: 'D3D9', value: 'D3D9' }, { label: 'XOpenGL', value: 'XOpenGL' }], tooltip: 'Selects the algorithm used for brightness and color correction.' },
        { key: 'OccludeLines', label: 'Occlude Lines', type: 'boolean', tooltip: 'Hides debug lines behind geometry. Mainly for development.' },
        { key: 'LODBias', label: 'LOD Bias', type: 'number', min: -10, max: 10, step: 0.1, tooltip: 'Adjusts texture sharpness. Negative values are sharper.' },
        { key: 'Saturation', label: 'Saturation', type: 'number', min: 0, max: 255, step: 1, tooltip: 'Adjusts color intensity. 255 is default.' },
        { key: 'Contrast', label: 'Contrast', type: 'number', min: 0, max: 255, step: 1, tooltip: 'Adjusts the difference between light and dark areas. 128 is default.' },
        { key: 'LinearBrightness', label: 'Linear Brightness', type: 'number', min: 0, max: 255, step: 1, tooltip: 'Adjusts overall image brightness. 128 is default.' },
        { key: 'GammaOffset', label: 'Gamma Offset', type: 'number', min: -1, max: 1, step: 0.1, tooltip: 'Fine-tune global gamma correction.' },
        { key: 'GammaOffsetRed', label: 'Gamma Offset Red', type: 'number', min: -1, max: 1, step: 0.1, tooltip: 'Fine-tune gamma for red channel.' },
        { key: 'GammaOffsetGreen', label: 'Gamma Offset Green', type: 'number', min: -1, max: 1, step: 0.1, tooltip: 'Fine-tune gamma for green channel.' },
        { key: 'GammaOffsetBlue', label: 'Gamma Offset Blue', type: 'number', min: -1, max: 1, step: 0.1, tooltip: 'Fine-tune gamma for blue channel.' },
        { key: 'UsePrecache', label: 'Precache', type: 'boolean', tooltip: 'Preloads textures and sounds to reduce stuttering during gameplay.' },
        { key: 'Coronas', label: 'Coronas', type: 'boolean', tooltip: 'Draws a halo effect around light sources.' },
        { key: 'ShinySurfaces', label: 'Shiny Surfaces', type: 'boolean', tooltip: 'Enables environment mapping on shiny surfaces like floors and weapons.' },
        { key: 'VolumetricLighting', label: 'Volumetric Lighting', type: 'boolean', tooltip: 'Enables fog-like lighting effects.' },
        { key: 'HighDetailActors', label: 'High Detail Actors', type: 'boolean', tooltip: 'Uses higher quality models for players and weapons if available.' },
        { key: 'GammaCorrectScreenshots', label: 'Gamma Correct Screenshots', type: 'boolean', tooltip: 'Ensures screenshots match the brightness of the game.' },
        { key: 'UseLightmapAtlas', label: 'Use Lightmap Atlas', type: 'boolean', tooltip: 'Optimizes rendering by merging lightmaps into fewer textures.' },
        { key: 'DetailTextures', label: 'Detail Textures', type: 'boolean', tooltip: 'Adds high-frequency noise to textures when viewed up close.' },
    ],
    'OpenGLDrv.OpenGLRenderDevice': [
        { key: 'SwapInterval', label: 'VSync', type: 'boolean', tooltip: 'Vertical Sync. Prevents screen tearing.' },
        { key: 'UseAA', label: 'Anti-Aliasing', type: 'boolean', tooltip: 'Smoothens jagged edges.' },
        { key: 'NumAASamples', label: 'AA Samples', type: 'select', options: [{ label: '2x', value: 2 }, { label: '4x', value: 4 }, { label: '8x', value: 8 }, { label: '16x', value: 16 }], tooltip: 'Higher values smooth edges more but reduce performance.' },
        { key: 'UsePrecache', label: 'Precache', type: 'boolean', tooltip: 'Preloads textures and sounds to reduce stuttering during gameplay.' },
        { key: 'UseTrilinear', label: 'Trilinear Filtering', type: 'boolean', tooltip: 'Smoothens textures at a distance. Low performance cost.' },
        { key: 'MaxAnisotropy', label: 'Anisotropic Filtering', type: 'select', options: [{ label: 'Off', value: 0 }, { label: '2x', value: 2 }, { label: '4x', value: 4 }, { label: '8x', value: 8 }, { label: '16x', value: 16 }], tooltip: 'Makes textures look sharp at oblique angles.' },
        { key: 'Coronas', label: 'Coronas', type: 'boolean', tooltip: 'Draws a halo effect around light sources.' },
        { key: 'ShinySurfaces', label: 'Shiny Surfaces', type: 'boolean', tooltip: 'Enables environment mapping on shiny surfaces like floors and weapons.' },
        { key: 'VolumetricLighting', label: 'Volumetric Lighting', type: 'boolean', tooltip: 'Enables fog-like lighting effects.' },
        { key: 'HighDetailActors', label: 'High Detail Actors', type: 'boolean', tooltip: 'Uses higher quality models for players and weapons if available.' },
        { key: 'DetailTextures', label: 'Detail Textures', type: 'boolean', tooltip: 'Adds high-frequency noise to textures when viewed up close.' },
        { key: 'UseHDTextures', label: 'Use HD Textures', type: 'boolean', tooltip: 'Enables support for high-resolution S3TC compressed textures.' },
        { key: 'UseLightmapAtlas', label: 'Use Lightmap Atlas', type: 'boolean', tooltip: 'Optimizes rendering by merging lightmaps into fewer textures.' },
        { key: 'OneXBlending', label: 'OneX Blending', type: 'boolean', tooltip: 'Adjusts brightness to match the classic Glide renderer look.' },
        { key: 'RefreshRate', label: 'Refresh Rate', type: 'number', min: 0, max: 240, step: 1, tooltip: 'Target refresh rate for the display.' },
        { key: 'ColorCorrectionMode', label: 'Color Correction Mode', type: 'select', options: [{ label: 'None', value: 'None' }, { label: 'Use Framebuffer', value: 'UseFramebuffer' }], tooltip: 'Method used for applying gamma correction.' },
        { key: 'PreferDedicatedGPU', label: 'Prefer Dedicated GPU', type: 'boolean', tooltip: 'Forces the game to use the discrete GPU on laptops.' },
        { key: 'SmoothMasking', label: 'Smooth Masking', type: 'boolean', tooltip: 'Reduces jagged edges on transparent textures like grates.' },
    ],
    'ICBINDx11Drv.ICBINDx11RenderDevice': [
        { key: 'UseVSync', label: 'VSync', type: 'boolean', tooltip: 'Vertical Sync. Prevents screen tearing.' },
        { key: 'ResolutionScale', label: 'Resolution Scale', type: 'number', min: 0.1, max: 2.0, step: 0.1, tooltip: 'Renders the game at a different resolution and scales it up/down.' },
        { key: 'NumAASamples', label: 'AA Samples', type: 'select', options: [{ label: 'Off', value: 1 }, { label: '2x', value: 2 }, { label: '4x', value: 4 }, { label: '8x', value: 8 }], tooltip: 'Higher values smooth edges more but reduce performance.' },
        { key: 'NumAFSamples', label: 'AF Samples', type: 'select', options: [{ label: 'Off', value: 1 }, { label: '2x', value: 2 }, { label: '4x', value: 4 }, { label: '8x', value: 8 }, { label: '16x', value: 16 }], tooltip: 'Controls the quality of texture filtering at angles.' },
        { key: 'UseHDR', label: 'HDR', type: 'boolean', tooltip: 'Enables wider color range and contrast on supported monitors.' },
        { key: 'HDRWhiteBalanceNits', label: 'HDR White Balance Nits', type: 'number', min: 0, max: 1000, step: 10, tooltip: 'Calibrates peak brightness for HDR displays.' },
        { key: 'GammaMode', label: 'Gamma Mode', type: 'select', options: [{ label: 'Default', value: 'Default' }, { label: 'XOpenGL', value: 'XOpenGL' }, { label: 'D3D9', value: 'D3D9' }], tooltip: 'Selects the algorithm used for brightness and color correction.' },
        { key: 'DetailTextures', label: 'Detail Textures', type: 'boolean', tooltip: 'Adds high-frequency noise to textures when viewed up close.' },
        { key: 'HighDetailActors', label: 'High Detail Actors', type: 'boolean', tooltip: 'Uses higher quality models for players and weapons if available.' },
        { key: 'Coronas', label: 'Coronas', type: 'boolean', tooltip: 'Draws a halo effect around light sources.' },
        { key: 'ShinySurfaces', label: 'Shiny Surfaces', type: 'boolean', tooltip: 'Enables environment mapping on shiny surfaces like floors and weapons.' },
        { key: 'VolumetricLighting', label: 'Volumetric Lighting', type: 'boolean', tooltip: 'Enables fog-like lighting effects.' },
        { key: 'bOneXLightmaps', label: 'OneX Lightmaps', type: 'boolean', tooltip: 'Adjusts lightmap brightness to match classic rendering.' },
        { key: 'bEnableCorrectFogging', label: 'Correct Fogging', type: 'boolean', tooltip: 'Fixes fog rendering issues found in older renderers.' },
        { key: '3DLineThickness', label: '3D Line Thickness', type: 'number', min: 0.1, max: 10, step: 0.1, tooltip: 'Adjusts the width of wireframe lines.' },
        { key: 'OrthoLineThickness', label: 'Ortho Line Thickness', type: 'number', min: 0.1, max: 10, step: 0.1, tooltip: 'Adjusts the width of lines in orthogonal views.' },
        { key: 'NumAdditionalBuffers', label: 'Num Additional Buffers', type: 'number', min: 0, max: 10, step: 1, tooltip: 'Increases buffering to reduce stuttering but uses more VRAM.' },
        { key: 'GammaOffset', label: 'Gamma Offset', type: 'number', min: -1, max: 1, step: 0.1, tooltip: 'Fine-tune global gamma correction.' },
        { key: 'SupportsUpdateTextureRect', label: 'Supports Update Texture Rect', type: 'boolean', tooltip: 'Enables optimized texture updates. Keep enabled.' },
        { key: 'AdditionalHDRExpansion', label: 'Additional HDR Expansion', type: 'number', min: 0, max: 10, step: 0.1, tooltip: 'Expands the dynamic range for HDR rendering.' },
        { key: 'UseDX9FlatColor', label: 'Use DX9 Flat Color', type: 'boolean', tooltip: 'Emulates DirectX 9 color handling.' },
        { key: 'MaskedAlphaReject', label: 'Masked Alpha Reject', type: 'number', min: 0, max: 1, step: 0.1, tooltip: 'Controls transparency cutoff for masked textures.' },
        { key: 'GammaOffsetRed', label: 'Gamma Offset Red', type: 'number', min: -1, max: 1, step: 0.1, tooltip: 'Fine-tune gamma for red channel.' },
        { key: 'GammaOffsetGreen', label: 'Gamma Offset Green', type: 'number', min: -1, max: 1, step: 0.1, tooltip: 'Fine-tune gamma for green channel.' },
        { key: 'GammaOffsetBlue', label: 'Gamma Offset Blue', type: 'number', min: -1, max: 1, step: 0.1, tooltip: 'Fine-tune gamma for blue channel.' },
        { key: 'DepthDrawZLimit', label: 'Depth Draw Z Limit', type: 'number', min: 0, max: 10000, step: 100, tooltip: 'Limits the drawing distance for depth calculations.' },
        { key: 'bUsePrecompiledShaders', label: 'Use Precompiled Shaders', type: 'boolean', tooltip: 'Speeds up startup by using cached shaders.' },
        { key: 'bUseForcedSampleCount', label: 'Use Forced Sample Count', type: 'boolean', tooltip: 'Forces the driver to use the specified AA sample count.' },
        { key: 'bSmoothHudTiles', label: 'Smooth HUD Tiles', type: 'boolean', tooltip: 'Applies smoothing to HUD elements.' },
        { key: 'SmoothMaskedAlphaReject', label: 'Smooth Masked Alpha Reject', type: 'number', min: 0, max: 1, step: 0.1, tooltip: 'Controls transparency cutoff for smoothed masked textures.' },
        { key: 'DisableFreeGSync', label: 'Disable Free GSync', type: 'boolean', tooltip: 'Prevents G-Sync/FreeSync from engaging.' },
        { key: 'bBicubicLightmaps', label: 'Bicubic Lightmaps', type: 'boolean', tooltip: 'Uses higher quality filtering for lightmaps.' },
        { key: 'ScreenFormat', label: 'Screen Format', type: 'select', options: [{ label: 'HDR16', value: 'HDR16' }, { label: 'HDR8', value: 'HDR8' }], tooltip: 'Color depth format for the rendering buffer.' },
        { key: 'AutodetectedWhiteBalance', label: 'Autodetected White Balance', type: 'number', min: 0, max: 1000, step: 10, tooltip: 'Automatically detected peak brightness.' },
    ],
    'VulkanDrv.VulkanRenderDevice': [
        { key: 'UseVSync', label: 'VSync', type: 'boolean', tooltip: 'Vertical Sync. Prevents screen tearing.' },
        { key: 'AntialiasMode', label: 'Anti-Aliasing Mode', type: 'select', options: [{ label: 'Off', value: 'Off' }, { label: 'MSAA', value: 'MSAA' }], tooltip: 'Technique used to smooth jagged edges.' },
        { key: 'Bloom', label: 'Bloom', type: 'boolean', tooltip: 'Creates a glowing effect around bright light sources.' },
        { key: 'BloomAmount', label: 'Bloom Amount', type: 'number', min: 0, max: 255, step: 1, tooltip: 'Controls the strength of the bloom effect.' },
        { key: 'Hdr', label: 'HDR', type: 'boolean', tooltip: 'Enables wider color range and contrast on supported monitors.' },
        { key: 'LightMode', label: 'Light Mode', type: 'select', options: [{ label: 'Normal', value: 'Normal' }, { label: 'One X Blending', value: 'OneXBlending' }, { label: 'Brighter Actors', value: 'BrighterActors' }], tooltip: 'Controls how light maps and actor lighting are blended.' },
        { key: 'GammaMode', label: 'Gamma Mode', type: 'select', options: [{ label: 'Default', value: 'Default' }, { label: 'D3D9', value: 'D3D9' }], tooltip: 'Selects the algorithm used for brightness and color correction.' },
        { key: 'OccludeLines', label: 'Occlude Lines', type: 'boolean', tooltip: 'Hides debug lines behind geometry. Mainly for development.' },
        { key: 'LODBias', label: 'LOD Bias', type: 'number', min: -10, max: 10, step: 0.1, tooltip: 'Adjusts texture sharpness. Negative values are sharper.' },
        { key: 'Saturation', label: 'Saturation', type: 'number', min: 0, max: 255, step: 1, tooltip: 'Adjusts color intensity. 255 is default.' },
        { key: 'Contrast', label: 'Contrast', type: 'number', min: 0, max: 255, step: 1, tooltip: 'Adjusts the difference between light and dark areas. 128 is default.' },
        { key: 'LinearBrightness', label: 'Linear Brightness', type: 'number', min: 0, max: 255, step: 1, tooltip: 'Adjusts overall image brightness. 128 is default.' },
        { key: 'GammaOffset', label: 'Gamma Offset', type: 'number', min: -1, max: 1, step: 0.1, tooltip: 'Fine-tune global gamma correction.' },
        { key: 'GammaOffsetRed', label: 'Gamma Offset Red', type: 'number', min: -1, max: 1, step: 0.1, tooltip: 'Fine-tune gamma for red channel.' },
        { key: 'GammaOffsetGreen', label: 'Gamma Offset Green', type: 'number', min: -1, max: 1, step: 0.1, tooltip: 'Fine-tune gamma for green channel.' },
        { key: 'GammaOffsetBlue', label: 'Gamma Offset Blue', type: 'number', min: -1, max: 1, step: 0.1, tooltip: 'Fine-tune gamma for blue channel.' },
        { key: 'VkExclusiveFullscreen', label: 'Exclusive Fullscreen', type: 'boolean', tooltip: 'Forces exclusive fullscreen mode. Can improve performance.' },
        { key: 'VkDeviceIndex', label: 'Vulkan Device Index', type: 'number', min: 0, max: 4, step: 1, tooltip: 'Selects the GPU to use for Vulkan rendering.' },
    ],
    'XOpenGLDrv.XOpenGLRenderDevice': [
        { key: 'UseVSync', label: 'VSync', type: 'select', options: [{ label: 'Off', value: 'Off' }, { label: 'On', value: 'On' }, { label: 'Adaptive', value: 'Adaptive' }], tooltip: 'Vertical Sync. Adaptive VSync reduces tearing without capping FPS.' },
        { key: 'OpenGLVersion', label: 'OpenGL Version', type: 'select', options: [{ label: 'Core', value: 'Core' }, { label: 'Compatibility', value: 'Compatibility' }, { label: 'ES', value: 'ES' }], tooltip: 'Selects the OpenGL profile. Core is recommended for modern GPUs.' },
        { key: 'UseAA', label: 'Anti-Aliasing', type: 'boolean', tooltip: 'Smoothens jagged edges.' },
        { key: 'NumAASamples', label: 'AA Samples', type: 'select', options: [{ label: 'Off', value: 0 }, { label: '2x', value: 2 }, { label: '4x', value: 4 }, { label: '8x', value: 8 }], tooltip: 'Higher values smooth edges more but reduce performance.' },
        { key: 'MaxAnisotropy', label: 'Anisotropic Filtering', type: 'number', min: 0, max: 16, step: 1, tooltip: 'Makes textures look sharp at oblique angles.' },
        { key: 'UseTrilinear', label: 'Trilinear Filtering', type: 'boolean', tooltip: 'Smoothens textures at a distance. Low performance cost.' },
        { key: 'LODBias', label: 'LOD Bias', type: 'number', min: -10, max: 10, step: 0.1, tooltip: 'Adjusts texture sharpness. Negative values are sharper.' },
        { key: 'GammaCorrectScreenshots', label: 'Gamma Correct Screenshots', type: 'boolean', tooltip: 'Ensures screenshots match the brightness of the game.' },
        { key: 'GammaOffsetScreenshots', label: 'Gamma Offset Screenshots', type: 'number', min: -1, max: 1, step: 0.1, tooltip: 'Fine-tune gamma for screenshots.' },
        { key: 'GammaMultiplier', label: 'Gamma Multiplier', type: 'number', min: 0, max: 2, step: 0.1, tooltip: 'Adjusts global brightness multiplier.' },
        { key: 'DetailTextures', label: 'Detail Textures', type: 'boolean', tooltip: 'Adds high-frequency noise to textures when viewed up close.' },
        { key: 'DetailMax', label: 'Detail Max', type: 'number', min: 0, max: 10, step: 1, tooltip: 'Limits the number of detail texture layers.' },
        { key: 'HighDetailActors', label: 'High Detail Actors', type: 'boolean', tooltip: 'Uses higher quality models for players and weapons if available.' },
        { key: 'Coronas', label: 'Coronas', type: 'boolean', tooltip: 'Draws a halo effect around light sources.' },
        { key: 'ShinySurfaces', label: 'Shiny Surfaces', type: 'boolean', tooltip: 'Enables environment mapping on shiny surfaces like floors and weapons.' },
        { key: 'VolumetricLighting', label: 'Volumetric Lighting', type: 'boolean', tooltip: 'Enables fog-like lighting effects.' },
        { key: 'UseHWClipping', label: 'HW Clipping', type: 'boolean', tooltip: 'Uses GPU for clipping geometry. Improves performance.' },
        { key: 'UseBindlessLightmaps', label: 'Bindless Lightmaps', type: 'boolean', tooltip: 'Optimizes lightmap rendering on modern GPUs.' },
        { key: 'UseShaderDrawParameters', label: 'Shader Draw Parameters', type: 'boolean', tooltip: 'Optimizes draw calls using shaders.' },
        { key: 'UseLightmapAtlas', label: 'Use Lightmap Atlas', type: 'boolean', tooltip: 'Optimizes rendering by merging lightmaps into fewer textures.' },
        { key: 'UseSRGBTextures', label: 'Use sRGB Textures', type: 'boolean', tooltip: 'Ensures correct color space handling for textures.' },
        { key: 'GenerateMipMaps', label: 'Generate MipMaps', type: 'boolean', tooltip: 'Automatically generates mipmaps for textures that lack them.' },
        { key: 'AlwaysMipmap', label: 'Always Mipmap', type: 'boolean', tooltip: 'Forces mipmap generation for all textures to reduce shimmering.' },
        { key: 'BumpMaps', label: 'Bump Maps', type: 'boolean', tooltip: 'Adds depth detail to surfaces using bump mapping.' },
        { key: 'UseBufferInvalidation', label: 'Use Buffer Invalidation', type: 'boolean', tooltip: 'Optimizes buffer updates. Can improve performance.' },
        { key: 'UseBindlessTextures', label: 'Bindless Textures', type: 'boolean', tooltip: 'Optimizes texture binding on supported GPUs.' },
        { key: 'NoAATiles', label: 'No AA Tiles', type: 'boolean', tooltip: 'Prevents anti-aliasing on 2D UI elements to keep them sharp.' },
        { key: 'MacroTextures', label: 'Macro Textures', type: 'boolean', tooltip: 'Adds large-scale texture variation to reduce repetition.' },
        { key: 'ShareLists', label: 'Share Lists', type: 'boolean', tooltip: 'Shares resources between contexts. Saves memory.' },
        { key: 'NoFiltering', label: 'No Filtering', type: 'boolean', tooltip: 'Disables texture filtering for a pixelated look.' },
        { key: 'ParallaxVersion', label: 'Parallax Version', type: 'select', options: [{ label: 'None', value: 'None' }, { label: 'POM', value: 'POM' }], tooltip: 'Selects the parallax mapping technique for depth illusion.' },
        { key: 'OneXBlending', label: 'OneX Blending', type: 'boolean', tooltip: 'Adjusts brightness to match the classic Glide renderer look.' },
        { key: 'ActorXBlending', label: 'Actor X Blending', type: 'boolean', tooltip: 'Improves how actors are blended with the environment.' },
    ],
    'SoftDrv.SoftwareRenderDevice': [
        { key: 'Translucency', label: 'Translucency', type: 'boolean', tooltip: 'Enables transparency effects.' },
        { key: 'VolumetricLighting', label: 'Volumetric Lighting', type: 'boolean', tooltip: 'Enables fog-like lighting effects.' },
        { key: 'ShinySurfaces', label: 'Shiny Surfaces', type: 'boolean', tooltip: 'Enables environment mapping on shiny surfaces.' },
        { key: 'Coronas', label: 'Coronas', type: 'boolean', tooltip: 'Draws a halo effect around light sources.' },
        { key: 'HighDetailActors', label: 'High Detail Actors', type: 'boolean', tooltip: 'Uses higher quality models for players and weapons.' },
        { key: 'HighResTextureSmooth', label: 'High Res Texture Smooth', type: 'boolean', tooltip: 'Smoothens high resolution textures.' },
        { key: 'LowResTextureSmooth', label: 'Low Res Texture Smooth', type: 'boolean', tooltip: 'Smoothens low resolution textures.' },
        { key: 'FastTranslucency', label: 'Fast Translucency', type: 'boolean', tooltip: 'Optimized translucency for software rendering.' },
    ],
    'GlideDrv.GlideRenderDevice': [
        { key: 'Translucency', label: 'Translucency', type: 'boolean', tooltip: 'Enables transparency effects.' },
        { key: 'VolumetricLighting', label: 'Volumetric Lighting', type: 'boolean', tooltip: 'Enables fog-like lighting effects.' },
        { key: 'ShinySurfaces', label: 'Shiny Surfaces', type: 'boolean', tooltip: 'Enables environment mapping on shiny surfaces.' },
        { key: 'Coronas', label: 'Coronas', type: 'boolean', tooltip: 'Draws a halo effect around light sources.' },
        { key: 'HighDetailActors', label: 'High Detail Actors', type: 'boolean', tooltip: 'Uses higher quality models for players and weapons.' },
        { key: 'DetailBias', label: 'Detail Bias', type: 'number', min: -10, max: 10, step: 0.1, tooltip: 'Adjusts the detail level of the world.' },
        { key: 'RefreshRate', label: 'Refresh Rate', type: 'select', options: [{ label: '60Hz', value: '60Hz' }, { label: '75Hz', value: '75Hz' }, { label: '85Hz', value: '85Hz' }, { label: '100Hz', value: '100Hz' }], tooltip: 'The refresh rate of the monitor when in Glide mode.' },
        { key: 'DetailTextures', label: 'Detail Textures', type: 'boolean', tooltip: 'Adds high-frequency noise to textures when viewed up close.' },
        { key: 'FastUglyRefresh', label: 'Fast Ugly Refresh', type: 'boolean', tooltip: 'Improves performance by sacrificing some visual quality during refreshes.' },
        { key: 'ScreenSmoothing', label: 'Screen Smoothing', type: 'boolean', tooltip: 'Smoothens the final image output.' },
    ],
    'MetalDrv.MetalRenderDevice': [
        { key: 'Translucency', label: 'Translucency', type: 'boolean', tooltip: 'Enables transparency effects.' },
        { key: 'VolumetricLighting', label: 'Volumetric Lighting', type: 'boolean', tooltip: 'Enables fog-like lighting effects.' },
        { key: 'ShinySurfaces', label: 'Shiny Surfaces', type: 'boolean', tooltip: 'Enables environment mapping on shiny surfaces.' },
        { key: 'Coronas', label: 'Coronas', type: 'boolean', tooltip: 'Draws a halo effect around light sources.' },
        { key: 'HighDetailActors', label: 'High Detail Actors', type: 'boolean', tooltip: 'Uses higher quality models for players and weapons.' },
        { key: 'DetailTextures', label: 'Detail Textures', type: 'boolean', tooltip: 'Adds high-frequency noise to textures when viewed up close.' },
    ],
}

const AUDIO_DEVICE_SETTINGS: Record<string, RenderDeviceSetting[]> = {
    'Cluster.ClusterAudioSubsystem': [
        { key: 'UseCDMusic', label: 'Use CD Music', type: 'boolean', tooltip: 'Enables playback of music from the CD-ROM drive.' },
        { key: 'UseDigitalMusic', label: 'Use Digital Music', type: 'boolean', tooltip: 'Enables playback of digital music files (UTMs, trackers).' },
        { key: 'EmulateGalaxyMusic', label: 'Emulate Galaxy Music', type: 'boolean', tooltip: 'Emulates the behavior of the original Galaxy audio system.' },
        { key: 'MusicVolume', label: 'Music Volume', type: 'number', min: 0, max: 255, step: 1, tooltip: 'Volume level for music.' },
        { key: 'SoundVolume', label: 'Sound Volume', type: 'number', min: 0, max: 255, step: 1, tooltip: 'Volume level for sound effects.' },
        { key: 'CDMusicVolumeFactor', label: 'CD Music Volume Factor', type: 'number', min: 0, max: 1, step: 0.01, tooltip: 'Multiplier for CD music volume.' },
        { key: 'EffectsChannels', label: 'Effects Channels', type: 'number', min: 1, max: 128, step: 1, tooltip: 'Number of simultaneous sound effect channels.' },
        { key: 'AudioDeviceGuid', label: 'Audio Device GUID', type: 'select', options: [{ label: 'Default', value: '' }], tooltip: 'Specific hardware identifier for the audio device.' },
    ],
    'ALAudio.ALAudioSubsystem': [
        { key: 'UseDigitalMusic', label: 'Use Digital Music', type: 'boolean', tooltip: 'Enables playback of digital music files.' },
        { key: 'MusicVolume', label: 'Music Volume', type: 'number', min: 0, max: 255, step: 1, tooltip: 'Volume level for music.' },
        { key: 'SoundVolume', label: 'Sound Volume', type: 'number', min: 0, max: 255, step: 1, tooltip: 'Volume level for sound effects.' },
        { key: 'SpeechVolume', label: 'Speech Volume', type: 'number', min: 0, max: 255, step: 1, tooltip: 'Volume level for voice messages.' },
        { key: 'UseSpeechVolume', label: 'Use Speech Volume', type: 'boolean', tooltip: 'Enables separate volume control for speech.' },
        { key: 'UseHRTF', label: 'Use HRTF', type: 'select', options: [{ label: 'Autodetect', value: 'Autodetect' }, { label: 'Enabled', value: 'Enabled' }, { label: 'Disabled', value: 'Disabled' }], tooltip: 'Head-Related Transfer Function. Provides 3D audio processing for headphones.' },
        { key: 'UseReverb', label: 'Use Reverb', type: 'boolean', tooltip: 'Enables environmental reverb effects.' },
        { key: 'ReverbIntensity', label: 'Reverb Intensity', type: 'number', min: 0, max: 2, step: 0.1, tooltip: 'Controls the strength of environmental reverb.' },
        { key: 'EmulateOldReverb', label: 'Emulate Old Reverb', type: 'boolean', tooltip: 'Emulates the reverb behavior of the original Galaxy system.' },
        { key: 'OldReverbIntensity', label: 'Old Reverb Intensity', type: 'number', min: 0, max: 2, step: 0.1, tooltip: 'Intensity level for legacy reverb emulation.' },
        { key: 'MusicAmplify', label: 'Music Amplify', type: 'number', min: 0, max: 10, step: 1, tooltip: 'Boosts the music volume beyond the default range.' },
        { key: 'MusicStereoAngle', label: 'Music Stereo Angle', type: 'number', min: 0, max: 360, step: 1, tooltip: 'Controls the stereo width of music.' },
        { key: 'MusicStereoMix', label: 'Music Stereo Mix', type: 'number', min: 0, max: 100, step: 1, tooltip: 'Percentage of stereo mixing for music.' },
        { key: 'MusicPanSeparation', label: 'Music Pan Separation', type: 'number', min: 0, max: 100, step: 1, tooltip: 'Controls left/right channel separation.' },
        { key: 'MusicDsp', label: 'Music DSP', type: 'select', options: [{ label: 'All', value: 'DSP_ALL' }, { label: 'Internal', value: 'DSP_INTERNAL' }, { label: 'None', value: 'DSP_NONE' }], tooltip: 'Digital Signal Processing mode for music.' },
        { key: 'MusicInterpolation', label: 'Music Interpolation', type: 'select', options: [{ label: 'Spline', value: 'SPLINE' }, { label: 'Linear', value: 'LINEAR' }, { label: 'None', value: 'NONE' }], tooltip: 'Sample interpolation method for music playback quality.' },
        { key: 'OutputRate', label: 'Output Rate', type: 'select', options: [{ label: '44100Hz', value: '44100Hz' }, { label: '48000Hz', value: '48000Hz' }, { label: '96000Hz', value: '96000Hz' }], tooltip: 'Sampling frequency of the audio output.' },
        { key: 'UseAutoSampleRate', label: 'Auto Sample Rate', type: 'boolean', tooltip: 'Automatically selects the sample rate based on the hardware.' },
        { key: 'DopplerFactor', label: 'Doppler Factor', type: 'number', min: 0, max: 10, step: 0.01, tooltip: 'Intensity of the Doppler shift effect for moving sounds.' },
        { key: 'bSoundAttenuate', label: 'Sound Attenuate', type: 'boolean', tooltip: 'Enables volume attenuation based on distance.' },
        { key: 'EffectsChannels', label: 'Effects Channels', type: 'number', min: 1, max: 128, step: 1, tooltip: 'Number of simultaneous sound effect channels.' },
        { key: 'ViewportVolumeIntensity', label: 'Viewport Volume Intensity', type: 'number', min: 0, max: 1, step: 0.1, tooltip: 'Adjusts volume based on viewport focus.' },
        { key: 'ProbeDevicesOnly', label: 'Probe Devices Only', type: 'boolean', tooltip: 'Attempts to detect audio devices without initializing them.' },
        { key: 'DetailStats', label: 'Detail Stats', type: 'boolean', tooltip: 'Enables detailed audio performance logging.' },
    ],
    'Galaxy.GalaxyAudioSubsystem': [
        { key: 'UseDigitalMusic', label: 'Use Digital Music', type: 'boolean', tooltip: 'Enables playback of digital music files.' },
        { key: 'UseCDMusic', label: 'Use CD Music', type: 'boolean', tooltip: 'Enables playback of music from the CD-ROM drive.' },
        { key: 'MusicVolume', label: 'Music Volume', type: 'number', min: 0, max: 255, step: 1, tooltip: 'Volume level for music.' },
        { key: 'SoundVolume', label: 'Sound Volume', type: 'number', min: 0, max: 255, step: 1, tooltip: 'Volume level for sound effects.' },
        { key: 'UseDirectSound', label: 'Use DirectSound', type: 'boolean', tooltip: 'Uses Microsoft DirectSound for audio output.' },
        { key: 'Use3dHardware', label: 'Use 3D Hardware', type: 'boolean', tooltip: 'Enables hardware acceleration for 3D sounds.' },
        { key: 'UseSurround', label: 'Use Surround', type: 'boolean', tooltip: 'Enables surround sound processing.' },
        { key: 'UseStereo', label: 'Use Stereo', type: 'boolean', tooltip: 'Enables stereo sound output.' },
        { key: 'UseFilter', label: 'Use Filter', type: 'boolean', tooltip: 'Applies frequency filtering to sounds.' },
        { key: 'UseSpatial', label: 'Use Spatial', type: 'boolean', tooltip: 'Enables spatial positioning of sounds.' },
        { key: 'UseReverb', label: 'Use Reverb', type: 'boolean', tooltip: 'Enables environmental reverb effects.' },
        { key: 'LowSoundQuality', label: 'Low Sound Quality', type: 'boolean', tooltip: 'Reduces sample rates to improve performance on old hardware.' },
        { key: 'ReverseStereo', label: 'Reverse Stereo', type: 'boolean', tooltip: 'Swaps the left and right audio channels.' },
        { key: 'Latency', label: 'Latency', type: 'number', min: 1, max: 200, step: 1, tooltip: 'Audio buffer size in milliseconds. Lower is more responsive but may crackle.' },
        { key: 'OutputRate', label: 'Output Rate', type: 'select', options: [{ label: '11025Hz', value: '11025Hz' }, { label: '22050Hz', value: '22050Hz' }, { label: '44100Hz', value: '44100Hz' }], tooltip: 'Sampling frequency of the audio output.' },
        { key: 'EffectsChannels', label: 'Effects Channels', type: 'number', min: 8, max: 64, step: 1, tooltip: 'Number of simultaneous sound effect channels.' },
        { key: 'DopplerSpeed', label: 'Doppler Speed', type: 'number', min: 0, max: 20000, step: 100, tooltip: 'Reference speed for calculating Doppler shift.' },
        { key: 'AmbientFactor', label: 'Ambient Factor', type: 'number', min: 0, max: 1, step: 0.1, tooltip: 'Adjusts the volume of ambient world sounds.' },
        { key: 'DetailStats', label: 'Detail Stats', type: 'boolean', tooltip: 'Enables detailed audio performance logging.' },
    ],
}

const LEGACY_RENDERERS: Record<string, string> = {
    'SoftDrv.SoftwareRenderDevice': 'Software Rendering',
    'GlideDrv.GlideRenderDevice': '3dfx Glide',
    'MetalDrv.MetalRenderDevice': 'S3 Metal',
}

const AUDIO_DEVICE_INFO: Record<string, { label: string; description: string; recommended?: boolean }> = {
    'ALAudio.ALAudioSubsystem': {
        label: 'OpenAL 3D',
        description: "OldUnreal's advanced OpenAL-based audio driver. Recommended for modern systems",
        recommended: true
    },
    'Cluster.ClusterAudioSubsystem': {
        label: 'Cluster Audio',
        description: 'Similar sounding subsitute for the legacy Galaxy Audio.'
    },
    'Galaxy.GalaxyAudioSubsystem': {
        label: 'Galaxy Audio',
        description: 'The original sound renderer for Unreal Tournament 1999. Not recommended for modern systems'
    }
}

export function UnrealTournamentSettings({ onBack }: UnrealTournamentSettingsProps) {
    // Player Settings
    const [playerName, setPlayerName] = useState('')
    const [playerTeam, setPlayerTeam] = useState('0')
    const [isSpectator, setIsSpectator] = useState(false)

    // Video Settings
    const [renderDevice, setRenderDevice] = useState('')
    const [resX, setResX] = useState('1920')
    const [resY, setResY] = useState('1080')
    const [fpsLimit, setFpsLimit] = useState('0')
    const [netspeed, setNetspeed] = useState(10000)
    const [deviceSettings, setDeviceSettings] = useState<Record<string, any>>({})

    // Audio Settings
    const [audioDevice, setAudioDevice] = useState('')
    const [audioSettings, setAudioSettings] = useState<Record<string, any>>({})

    // Binds
    const [binds, setBinds] = useState<Record<string, string[]>>({}) // command -> keys[]
    const [editingBind, setEditingBind] = useState<{ command: string, slot: number } | null>(null)

    // Import modal state
    const [importModalState, setImportModalState] = useState<'hidden' | 'loading' | 'success' | 'error'>('hidden')
    const [importErrorMessage, setImportErrorMessage] = useState('')
    const [importType, setImportType] = useState<'binds' | 'graphics' | 'music' | 'game'>('binds')

    // Game Options Settings
    const [fov, setFov] = useState('90.000000')
    const [dodging, setDodging] = useState(true)
    const [screenFlashes, setScreenFlashes] = useState(true)
    const [goreLevel, setGoreLevel] = useState<'normal' | 'reduced' | 'ultra-low'>('normal')
    const [weaponHand, setWeaponHand] = useState('0.000000') // Default to Center/Right? Let's check docs: -1 right, 1 left, 0 center, 2 hidden. User says -1 right, 1 left, 0 center, 2 hidden.

    // Conflict confirmation state
    const [conflictInfo, setConflictInfo] = useState<{
        key: string,
        newCommand: string,
        newSlot: number,
        existingCommand: string
    } | null>(null)

    useEffect(() => {
        loadSettings()
    }, [])

    useEffect(() => {
        if (window.utProfile) {
            const cleanup = window.utProfile.onChanged(() => {
                loadSettings()
            })
            return cleanup
        }
        return undefined
    }, [])

    const loadSettings = async () => {
        try {
            // Player
            const name = await window.conveyor.ini.readIniValue('User.ini', 'DefaultPlayer', 'Name')
            setPlayerName(name || 'Player')

            const team = await window.conveyor.ini.readIniValue('User.ini', 'DefaultPlayer', 'team')
            setPlayerTeam(team || '0')

            const overrideClass = await window.conveyor.ini.readIniValue('User.ini', 'DefaultPlayer', 'OverrideClass')
            setIsSpectator(overrideClass === 'Botpack.CHSpectator')

            // Video
            const device = await window.conveyor.ini.readIniValue('UnrealTournament.ini', 'Engine.Engine', 'GameRenderDevice')
            setRenderDevice(device || 'D3D9Drv.D3D9RenderDevice')

            const x = await window.conveyor.ini.readIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'FullscreenViewportX')
            setResX(x || '1920')

            const y = await window.conveyor.ini.readIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'FullscreenViewportY')
            setResY(y || '1080')

            const fps = await window.conveyor.ini.readIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'FrameRateLimit')
            setFpsLimit(fps || '0')

            const speed = await window.conveyor.ini.readIniValue('UnrealTournament.ini', 'Engine.Player', 'ConfiguredInternetSpeed')
            setNetspeed(parseInt(speed || '10000', 10))

            // Device Specific Settings
            if (device) {
                const settingsConfig = RENDER_DEVICE_SETTINGS[device]
                if (settingsConfig) {
                    const currentSettings: Record<string, any> = {}
                    for (const setting of settingsConfig) {
                        const val = await window.conveyor.ini.readIniValue('UnrealTournament.ini', device, setting.key)
                        if (setting.type === 'boolean') {
                            currentSettings[setting.key] = val?.toLowerCase() === 'true' || val === '1'
                        } else if (setting.type === 'number') {
                            currentSettings[setting.key] = parseFloat(val || '0')
                        } else {
                            currentSettings[setting.key] = val
                        }
                    }
                    setDeviceSettings(currentSettings)
                }
            }

            // Audio
            const aDevice = await window.conveyor.ini.readIniValue('UnrealTournament.ini', 'Engine.Engine', 'AudioDevice')
            setAudioDevice(aDevice || 'Galaxy.GalaxyAudioSubsystem')

            if (aDevice) {
                const settingsConfig = AUDIO_DEVICE_SETTINGS[aDevice]
                if (settingsConfig) {
                    const currentSettings: Record<string, any> = {}
                    for (const setting of settingsConfig) {
                        const val = await window.conveyor.ini.readIniValue('UnrealTournament.ini', aDevice, setting.key)
                        if (setting.type === 'boolean') {
                            currentSettings[setting.key] = val?.toLowerCase() === 'true' || val === '1'
                        } else if (setting.type === 'number') {
                            currentSettings[setting.key] = parseFloat(val || '0')
                        } else {
                            currentSettings[setting.key] = val
                        }
                    }
                    setAudioSettings(currentSettings)
                }
            }

            // Binds
            const inputSection = await window.conveyor.ini.readIniSection('User.ini', 'Engine.Input') as Record<string, string | string[]> | undefined
            if (inputSection) {
                const newBinds: Record<string, string[]> = {}
                Object.entries(inputSection).forEach(([key, commandValue]) => {
                    const commands = Array.isArray(commandValue) ? commandValue : [commandValue]

                    commands.forEach(command => {
                        if (!command) return

                        const normalizedCommand = command.toLowerCase()
                        if (!newBinds[normalizedCommand]) {
                            newBinds[normalizedCommand] = []
                        }
                        if (newBinds[normalizedCommand].length < 2) {
                            newBinds[normalizedCommand].push(key)
                        }
                    })
                })
                setBinds(newBinds)
            }

            // Game Options
            const fovVal = await window.conveyor.ini.readIniValue('User.ini', 'Engine.PlayerPawn', 'DesiredFOV')
            setFov(fovVal || '90.000000')

            const dodgeVal = await window.conveyor.ini.readIniValue('User.ini', 'Engine.PlayerPawn', 'DodgeClickTime')
            setDodging(dodgeVal !== '-1.000000')

            const flashesVal = await window.conveyor.ini.readIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'ScreenFlashes')
            setScreenFlashes(flashesVal?.toLowerCase() === 'true')

            const lowGore = await window.conveyor.ini.readIniValue('UnrealTournament.ini', 'Engine.GameInfo', 'bLowGore')
            const veryLowGore = await window.conveyor.ini.readIniValue('UnrealTournament.ini', 'Engine.GameInfo', 'bVeryLowGore')
            if (lowGore?.toLowerCase() === 'true' && veryLowGore?.toLowerCase() === 'true') {
                setGoreLevel('ultra-low')
            } else if (lowGore?.toLowerCase() === 'true') {
                setGoreLevel('reduced')
            } else {
                setGoreLevel('normal')
            }

            const handVal = await window.conveyor.ini.readIniValue('User.ini', 'Engine.PlayerPawn', 'Handedness')
            setWeaponHand(handVal || '0.000000')
        } catch (err) {
            console.error('Failed to load settings', err)
        }
    }

    const savePlayerSettings = async () => {
        await window.conveyor.ini.writeIniValue('User.ini', 'DefaultPlayer', 'Name', playerName)
        await window.conveyor.ini.writeIniValue('User.ini', 'DefaultPlayer', 'team', playerTeam)
        await window.conveyor.ini.writeIniValue('User.ini', 'DefaultPlayer', 'OverrideClass', isSpectator ? 'Botpack.CHSpectator' : '')
    }

    const handleExportGameSettings = () => {
        const exportData = {
            version: '1.0',
            type: 'game',
            settings: {
                fov,
                dodging,
                screenFlashes,
                goreLevel,
                weaponHand
            }
        }

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `ut99-game-settings-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const handleImportGameSettings = async () => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json'
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (!file) return

            try {
                const text = await file.text()
                const data = JSON.parse(text)

                if (data.type !== 'game' || !data.settings) {
                    setImportErrorMessage('Invalid game settings file.')
                    setImportModalState('error')
                    return
                }

                setImportType('game')
                    // Store the data somewhere to use in confirming
                    ; (window as any)._pendingImportData = data.settings
                setImportModalState('success')
            } catch (err) {
                setImportErrorMessage('Failed to parse settings file.')
                setImportModalState('error')
            }
        }
        input.click()
    }

    const saveVideoSettings = async () => {
        await window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'Engine.Engine', 'GameRenderDevice', renderDevice)
        await window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'FullscreenViewportX', resX)
        await window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'FullscreenViewportY', resY)
        await window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'FrameRateLimit', fpsLimit)
        await window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'Engine.Player', 'ConfiguredInternetSpeed', netspeed.toString())
    }

    const updateDeviceSetting = async (key: string, value: any) => {
        setDeviceSettings(prev => ({ ...prev, [key]: value }))

        // Find the setting definition to know how to format the value
        const settingDef = RENDER_DEVICE_SETTINGS[renderDevice]?.find(s => s.key === key)
        let stringValue = String(value)

        if (settingDef?.type === 'boolean') {
            if (key === 'SwapInterval') {
                stringValue = value ? '1' : '0'
            } else {
                stringValue = value ? 'True' : 'False'
            }
        }

        await window.conveyor.ini.writeIniValue('UnrealTournament.ini', renderDevice, key, stringValue)
    }

    const updateAudioSetting = async (key: string, value: any) => {
        setAudioSettings(prev => ({ ...prev, [key]: value }))

        const settingDef = AUDIO_DEVICE_SETTINGS[audioDevice]?.find(s => s.key === key)
        let stringValue = String(value)

        if (settingDef?.type === 'boolean') {
            stringValue = value ? 'True' : 'False'
        }

        await window.conveyor.ini.writeIniValue('UnrealTournament.ini', audioDevice, key, stringValue)
    }

    const updateFov = async (value: string) => {
        setFov(value)
        await window.conveyor.ini.writeIniValue('User.ini', 'Engine.PlayerPawn', 'DesiredFOV', value)
    }

    const updateDodging = async (enabled: boolean) => {
        setDodging(enabled)
        const value = enabled ? '0.250000' : '-1.000000'
        await window.conveyor.ini.writeIniValue('User.ini', 'Engine.PlayerPawn', 'DodgeClickTime', value)
    }

    const updateScreenFlashes = async (enabled: boolean) => {
        setScreenFlashes(enabled)
        await window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'ScreenFlashes', enabled ? 'True' : 'False')
    }

    const updateGoreLevel = async (level: 'normal' | 'reduced' | 'ultra-low') => {
        setGoreLevel(level)
        let lowGore = 'False'
        let veryLowGore = 'False'

        if (level === 'reduced') {
            lowGore = 'True'
        } else if (level === 'ultra-low') {
            lowGore = 'True'
            veryLowGore = 'True'
        }

        await window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'Engine.GameInfo', 'bLowGore', lowGore)
        await window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'Engine.GameInfo', 'bVeryLowGore', veryLowGore)
    }

    const updateWeaponHand = async (value: string) => {
        setWeaponHand(value)
        await window.conveyor.ini.writeIniValue('User.ini', 'Engine.PlayerPawn', 'Handedness', value)
    }

    const handleExportVideoSettings = () => {
        const exportData = {
            version: '1.0',
            renderer: renderDevice,
            exportedAt: new Date().toISOString(),
            settings: deviceSettings
        }

        const jsonString = JSON.stringify(exportData, null, 2)
        const blob = new Blob([jsonString], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `ut-graphics-${renderDevice.split('.')[0]}-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    const handleImportVideoSettings = async () => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json'

        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (!file) return

            setImportType('graphics')
            setImportModalState('loading')

            try {
                const text = await file.text()
                const importData = JSON.parse(text)

                if (!importData.renderer || !importData.settings) {
                    setImportErrorMessage('Invalid graphics settings file format')
                    setImportModalState('error')
                    return
                }

                if (importData.renderer !== renderDevice) {
                    setImportErrorMessage(`File is for ${importData.renderer}, but you have ${renderDevice} selected.`)
                    setImportModalState('error')
                    return
                }

                const newSettings = importData.settings
                setDeviceSettings(newSettings)

                // Write to INI
                for (const [key, value] of Object.entries(newSettings)) {
                    await updateDeviceSetting(key, value)
                }

                setImportModalState('success')
            } catch (err) {
                console.error('Failed to import graphics settings', err)
                setImportErrorMessage('Failed to import graphics settings. Please check the file format.')
                setImportModalState('error')
            }
        }

        input.click()
    }

    const handleExportMusicSettings = () => {
        const exportData = {
            version: '1.0',
            device: audioDevice,
            exportedAt: new Date().toISOString(),
            settings: audioSettings
        }

        const jsonString = JSON.stringify(exportData, null, 2)
        const blob = new Blob([jsonString], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `ut-audio-${audioDevice.split('.')[0]}-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    const handleImportMusicSettings = async () => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json'

        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (!file) return

            setImportType('music')
            setImportModalState('loading')

            try {
                const text = await file.text()
                const importData = JSON.parse(text)

                if (!importData.device || !importData.settings) {
                    setImportErrorMessage('Invalid audio settings file format')
                    setImportModalState('error')
                    return
                }

                if (importData.device !== audioDevice) {
                    setImportErrorMessage(`File is for ${importData.device}, but you have ${audioDevice} selected.`)
                    setImportModalState('error')
                    return
                }

                const newSettings = importData.settings
                setAudioSettings(newSettings)

                // Write to INI
                for (const [key, value] of Object.entries(newSettings)) {
                    await updateAudioSetting(key, value)
                }

                setImportModalState('success')
            } catch (err) {
                console.error('Failed to import audio settings', err)
                setImportErrorMessage('Failed to import audio settings. Please check the file format.')
                setImportModalState('error')
            }
        }

        input.click()
    }

    const handleBindClick = (command: string, slot: number) => {
        setEditingBind({ command, slot })
    }

    const mapKeyToUT = (code: string): string => {
        const map: Record<string, string> = {
            'ControlLeft': 'Ctrl',
            'ControlRight': 'Ctrl',
            'ShiftLeft': 'Shift',
            'ShiftRight': 'Shift',
            'AltLeft': 'Alt',
            'AltRight': 'Alt',
            'Space': 'Space',
            'Enter': 'Enter',
            'Escape': 'Escape',
            'Backspace': 'Backspace',
            'Tab': 'Tab',
            'CapsLock': 'CapsLock',
            'Delete': 'Delete',
            'Insert': 'Insert',
            'Home': 'Home',
            'End': 'End',
            'PageUp': 'PageUp',
            'PageDown': 'PageDown',
            'ArrowUp': 'Up',
            'ArrowDown': 'Down',
            'ArrowLeft': 'Left',
            'ArrowRight': 'Right',
            'NumLock': 'NumLock',
            'ScrollLock': 'ScrollLock',
            'Pause': 'Pause',
            'PrintScreen': 'PrintScrn',
            'Backquote': 'Tilde',
            'Minus': '-',
            'Equal': '=',
            'BracketLeft': '[',
            'BracketRight': ']',
            'Backslash': '\\',
            'Semicolon': ';',
            'Quote': "'",
            'Comma': ',',
            'Period': '.',
            'Slash': '/',
        }

        if (map[code]) return map[code]
        if (code.startsWith('Key')) return code.slice(3)
        if (code.startsWith('Digit')) return code.slice(5)
        if (code.startsWith('Numpad')) return code

        return code
    }

    const applyBind = async (key: string, command: string, slot: number) => {
        const normalizedCommand = command.toLowerCase()

        const val = binds[normalizedCommand]
        const currentBinds = Array.isArray(val) ? val : []
        const oldKey = currentBinds[slot]
        if (oldKey) {
            await window.conveyor.ini.writeIniValue('User.ini', 'Engine.Input', oldKey, '')
        }

        await window.conveyor.ini.writeIniValue('User.ini', 'Engine.Input', key, command)

        setBinds(prev => {
            const newBinds = { ...prev }

            Object.keys(newBinds).forEach(cmd => {
                const cmdBinds = newBinds[cmd]
                if (Array.isArray(cmdBinds)) {
                    newBinds[cmd] = cmdBinds.filter(k => k.toLowerCase() !== key.toLowerCase())
                } else {
                    newBinds[cmd] = []
                }
            })

            if (!newBinds[normalizedCommand]) {
                newBinds[normalizedCommand] = []
            }
            while (newBinds[normalizedCommand].length <= slot) {
                newBinds[normalizedCommand].push('')
            }
            newBinds[normalizedCommand][slot] = key

            return newBinds
        })

        setEditingBind(null)
        setConflictInfo(null)
    }

    const handleInput = useCallback(async (key: string) => {
        if (!editingBind) return

        const { command, slot } = editingBind

        let existingCommand = ''
        Object.entries(binds).forEach(([cmd, keys]) => {
            if (keys.some(k => k.toLowerCase() === key.toLowerCase()) && cmd.toLowerCase() !== command.toLowerCase()) {
                existingCommand = cmd
            }
        })

        if (existingCommand) {
            setConflictInfo({
                key,
                newCommand: command,
                newSlot: slot,
                existingCommand
            })
            setEditingBind(null)
            return
        }

        await applyBind(key, command, slot)
    }, [editingBind, binds])

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!editingBind) return
        e.preventDefault()
        e.stopPropagation()

        if (e.code === 'Escape') {
            setEditingBind(null)
            return
        }

        const utKey = mapKeyToUT(e.code)
        handleInput(utKey)
    }, [editingBind, handleInput])

    const handleMouseDown = useCallback((e: MouseEvent) => {
        if (!editingBind) return

        if ((e.target as HTMLElement).closest('button')) {
            return
        }

        e.preventDefault()
        e.stopPropagation()

        const buttonMap: Record<number, string> = {
            0: 'LeftMouse',
            1: 'MiddleMouse',
            2: 'RightMouse',
            3: 'Mouse4',
            4: 'Mouse5'
        }

        const utKey = buttonMap[e.button]
        if (utKey) {
            handleInput(utKey)
        }
    }, [editingBind, handleInput])

    const handleWheel = useCallback((e: WheelEvent) => {
        if (!editingBind) return
        e.preventDefault()
        e.stopPropagation()

        const utKey = e.deltaY < 0 ? 'MouseWheelUp' : 'MouseWheelDown'
        handleInput(utKey)
    }, [editingBind, handleInput])

    useEffect(() => {
        if (editingBind) {
            window.addEventListener('keydown', handleKeyDown)
            window.addEventListener('mousedown', handleMouseDown, { capture: true })
            window.addEventListener('wheel', handleWheel, { capture: true, passive: false })
            return () => {
                window.removeEventListener('keydown', handleKeyDown)
                window.removeEventListener('mousedown', handleMouseDown, { capture: true })
                window.removeEventListener('wheel', handleWheel, { capture: true })
            }
        }
        return undefined
    }, [editingBind, handleKeyDown, handleMouseDown, handleWheel])

    const handleClearBind = async () => {
        if (!editingBind) return

        const { command, slot } = editingBind
        const normalizedCommand = command.toLowerCase()
        const val = binds[normalizedCommand]
        const currentBinds = Array.isArray(val) ? val : []
        const currentKey = currentBinds[slot]

        if (currentKey) {
            await window.conveyor.ini.writeIniValue('User.ini', 'Engine.Input', currentKey, '')

            setBinds(prev => {
                const newBinds = { ...prev }
                if (newBinds[normalizedCommand]) {
                    const newCommandBinds = [...newBinds[normalizedCommand]]
                    newCommandBinds[slot] = ''
                    newBinds[normalizedCommand] = newCommandBinds
                }
                return newBinds
            })
        }
        setEditingBind(null)
    }

    const handleExportBinds = () => {
        const configurableCommands = BIND_CATEGORIES
            .flatMap(category => category.binds)
            .map(bind => bind.command.toLowerCase())

        const filteredBinds: Record<string, string[]> = {}
        for (const command of configurableCommands) {
            if (binds[command]) {
                filteredBinds[command] = binds[command]
            }
        }

        const exportData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            binds: filteredBinds
        }

        const jsonString = JSON.stringify(exportData, null, 2)

        const blob = new Blob([jsonString], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `ut-keybinds-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    const handleImportBinds = async () => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json'

        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (!file) return

            setImportType('binds')
            setImportModalState('loading')

            try {
                const text = await file.text()
                const importData = JSON.parse(text)

                if (!importData.binds || typeof importData.binds !== 'object') {
                    setImportErrorMessage('Invalid keybind file format')
                    setImportModalState('error')
                    return
                }

                // Store the data somewhere to use in confirming
                ; (window as any)._pendingImportData = importData.binds
                setImportModalState('success')
            } catch (err) {
                console.error('Failed to import keybinds', err)
                setImportErrorMessage('Failed to import keybinds. Please check the file format.')
                setImportModalState('error')
            }
        }

        input.click()
    }

    const handleImportConfirm = async () => {
        try {
            if (importType === 'binds') {
                const importedBinds: Record<string, string[]> = (window as any)._pendingImportData
                if (importedBinds) {
                    // Clear existing binds in INI
                    const inputSection = await window.conveyor.ini.readIniSection('User.ini', 'Engine.Input') as Record<string, string | string[]> | undefined
                    if (inputSection) {
                        for (const key of Object.keys(inputSection)) {
                            await window.conveyor.ini.writeIniValue('User.ini', 'Engine.Input', key, '')
                        }
                    }

                    // Apply imported binds
                    for (const [command, keys] of Object.entries(importedBinds)) {
                        if (Array.isArray(keys)) {
                            for (const key of keys) {
                                if (key) {
                                    const originalCommand = BIND_CATEGORIES
                                        .flatMap(c => c.binds)
                                        .find(b => b.command.toLowerCase() === command)?.command || command

                                    await window.conveyor.ini.writeIniValue('User.ini', 'Engine.Input', key, originalCommand)
                                }
                            }
                        }
                    }
                    setBinds(importedBinds)
                }
                setImportModalState('hidden')
                delete (window as any)._pendingImportData
                await loadSettings()
            } else if (importType === 'graphics') {
                const newSettings = (window as any)._pendingImportData
                if (newSettings) {
                    setDeviceSettings(newSettings)
                    for (const [key, value] of Object.entries(newSettings)) {
                        await updateDeviceSetting(key, value)
                    }
                }
                setImportModalState('hidden')
                delete (window as any)._pendingImportData
                await loadSettings()
            } else if (importType === 'music') {
                const newSettings = (window as any)._pendingImportData
                if (newSettings) {
                    setAudioSettings(newSettings)
                    for (const [key, value] of Object.entries(newSettings)) {
                        await updateAudioSetting(key, value)
                    }
                }
                setImportModalState('hidden')
                delete (window as any)._pendingImportData
                await loadSettings()
            } else if (importType === 'game') {
                const settings = (window as any)._pendingImportData
                if (settings) {
                    if (settings.fov !== undefined) await updateFov(settings.fov)
                    if (settings.dodging !== undefined) await updateDodging(settings.dodging)
                    if (settings.screenFlashes !== undefined) await updateScreenFlashes(settings.screenFlashes)
                    if (settings.goreLevel !== undefined) await updateGoreLevel(settings.goreLevel)
                    if (settings.weaponHand !== undefined) await updateWeaponHand(settings.weaponHand)
                }
                setImportModalState('hidden')
                delete (window as any)._pendingImportData
                await loadSettings()
            }
        } catch (err) {
            console.error('Failed to confirm import', err)
            setImportErrorMessage('Failed to apply imported settings.')
            setImportModalState('error')
        }
    }

    return (
        <div className="space-y-6 pb-12 relative">
            {editingBind && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-card border border-border p-8 rounded-xl shadow-2xl max-w-md w-full text-center space-y-6 animate-in fade-in zoom-in duration-200">
                        <div className="space-y-2">
                            <h3 className="text-xl font-bold">Bind Action</h3>
                            <p className="text-muted-foreground">
                                Press any key, mouse button, or scroll wheel to bind to <span className="text-foreground font-semibold">"{BIND_CATEGORIES.flatMap(c => c.binds).find(b => b.command === editingBind.command)?.label}"</span> (Slot {editingBind.slot + 1})
                            </p>
                        </div>

                        <div className="p-8 border-2 border-dashed border-muted rounded-lg bg-muted/10 animate-pulse">
                            <span className="text-lg font-mono text-primary">Waiting for input...</span>
                        </div>

                        <div className="flex gap-3 justify-center">
                            <Button
                                variant="destructive"
                                onClick={handleClearBind}
                            >
                                Clear Bind
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={() => setEditingBind(null)}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {conflictInfo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-card border border-border p-8 rounded-xl shadow-2xl max-w-md w-full text-center space-y-6 animate-in fade-in zoom-in duration-200">
                        <div className="space-y-2">
                            <h3 className="text-xl font-bold flex items-center justify-center gap-2">
                                <XCircle className="size-6 text-yellow-500" />
                                Binding Conflict
                            </h3>
                            <p className="text-muted-foreground">
                                <span className="text-foreground font-semibold">"{conflictInfo.key}"</span> is already bound to <span className="text-foreground font-semibold">"{BIND_CATEGORIES.flatMap(c => c.binds).find(b => b.command.toLowerCase() === conflictInfo.existingCommand.toLowerCase())?.label || conflictInfo.existingCommand}"</span>.
                            </p>
                            <p className="text-muted-foreground">
                                Do you want to replace it?
                            </p>
                        </div>

                        <div className="flex gap-3 justify-center">
                            <Button
                                variant="default"
                                className="bg-yellow-600 hover:bg-yellow-700 text-white border-yellow-600"
                                onClick={() => applyBind(conflictInfo.key, conflictInfo.newCommand, conflictInfo.newSlot)}
                            >
                                Replace
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={() => setConflictInfo(null)}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Import Modal */}
            {importModalState !== 'hidden' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-card border border-border p-8 rounded-xl shadow-2xl max-w-md w-full text-center space-y-6 animate-in fade-in zoom-in duration-200">
                        {importModalState === 'loading' && (
                            <>
                                <div className="space-y-2">
                                    <h3 className="text-xl font-bold">Importing {importType === 'binds' ? 'Keybinds' : importType === 'graphics' ? 'Graphics Settings' : importType === 'music' ? 'Audio Settings' : 'Game Settings'}</h3>
                                    <p className="text-muted-foreground">
                                        Please wait while we import your {importType === 'binds' ? 'keybind' : importType === 'graphics' ? 'graphics' : importType === 'music' ? 'audio' : 'game'} configuration...
                                    </p>
                                </div>

                                <div className="p-8 border-2 border-dashed border-muted rounded-lg bg-muted/10">
                                    <Loader2 className="size-12 mx-auto text-primary animate-spin" />
                                </div>
                            </>
                        )}

                        {importModalState === 'success' && (
                            <>
                                <div className="space-y-2">
                                    <h3 className="text-xl font-bold text-green-500">Import Successful!</h3>
                                    <p className="text-muted-foreground">
                                        Your {importType === 'binds' ? 'keybinds' : importType === 'graphics' ? 'graphics settings' : importType === 'music' ? 'audio settings' : 'game settings'} have been imported and applied successfully.
                                    </p>
                                </div>

                                <div className="p-8 rounded-lg bg-green-500/10">
                                    <CheckCircle className="size-16 mx-auto text-green-500" />
                                </div>

                                <Button
                                    onClick={handleImportConfirm}
                                    className="w-full"
                                >
                                    Close
                                </Button>
                            </>
                        )}

                        {importModalState === 'error' && (
                            <>
                                <div className="space-y-2">
                                    <h3 className="text-xl font-bold text-red-500">Import Failed</h3>
                                    <p className="text-muted-foreground">
                                        {importErrorMessage}
                                    </p>
                                </div>

                                <div className="p-8 rounded-lg bg-red-500/10">
                                    <XCircle className="size-16 mx-auto text-red-500" />
                                </div>

                                <Button
                                    variant="destructive"
                                    onClick={() => setImportModalState('hidden')}
                                    className="w-full"
                                >
                                    Close
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            )}

            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onBack}>
                    <ArrowLeft className="size-5" />
                </Button>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Unreal Tournament</h2>
                    <p className="text-muted-foreground">Configure game-specific settings.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* Player Settings */}
                <SettingsSection
                    title="Player Details"
                    icon={<User className="size-6" />}
                    defaultOpen={true}
                    activeIconClassName="bg-blue-500/10 text-blue-500"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Name</label>
                            <Input
                                value={playerName}
                                onChange={(e) => setPlayerName(e.target.value)}
                                onBlur={savePlayerSettings}
                                maxLength={20}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Team</label>
                            <div className="flex gap-2">
                                <Button
                                    variant={playerTeam === '0' ? 'default' : 'outline'}
                                    className={cn(
                                        "flex-1 transition-all duration-200",
                                        playerTeam === '0'
                                            ? "bg-red-600 hover:bg-red-700 text-white border-red-600"
                                            : "hover:border-red-500 hover:text-red-500 hover:bg-red-50"
                                    )}
                                    onClick={() => {
                                        setPlayerTeam('0')
                                        window.conveyor.ini.writeIniValue('User.ini', 'DefaultPlayer', 'team', '0')
                                    }}
                                >
                                    Red
                                </Button>
                                <Button
                                    variant={playerTeam === '1' ? 'default' : 'outline'}
                                    className={cn(
                                        "flex-1 transition-all duration-200",
                                        playerTeam === '1'
                                            ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                                            : "hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50"
                                    )}
                                    onClick={() => {
                                        setPlayerTeam('1')
                                        window.conveyor.ini.writeIniValue('User.ini', 'DefaultPlayer', 'team', '1')
                                    }}
                                >
                                    Blue
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Join As</label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={isSpectator ? 'yes' : 'no'}
                                onChange={(e) => {
                                    const val = e.target.value === 'yes'
                                    setIsSpectator(val)
                                    window.conveyor.ini.writeIniValue('User.ini', 'DefaultPlayer', 'OverrideClass', val ? 'Botpack.CHSpectator' : '')
                                }}
                            >
                                <option value="no">Player</option>
                                <option value="yes">Spectator</option>
                            </select>
                        </div>
                    </div>
                </SettingsSection>

                {/* Game Options */}
                <SettingsSection
                    title="Game Options"
                    icon={<Joystick className="size-6" />}
                    activeIconClassName="bg-cyan-500/10 text-cyan-500"
                    headerAction={
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleExportGameSettings}
                                className="gap-2"
                            >
                                <Download className="size-4" />
                                Export
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleImportGameSettings}
                                className="gap-2"
                            >
                                <Upload className="size-4" />
                                Import
                            </Button>
                        </div>
                    }
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-medium">FOV</label>
                                    <Tooltip content="Field of View. Higher values allow you to see more of your surroundings." />
                                </div>
                                <span className="text-sm text-muted-foreground">{parseFloat(fov).toFixed(0)}</span>
                            </div>
                            <Slider
                                min={60}
                                max={120}
                                step={1}
                                value={parseFloat(fov)}
                                onChange={(e) => setFov(parseFloat(e.target.value).toFixed(6))}
                                onMouseUp={() => updateFov(fov)}
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium">Dodging</label>
                                <Tooltip content="Double-tap a movement key to dodge." />
                            </div>
                            <div className="flex items-center h-10">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={dodging}
                                        onChange={(e) => updateDodging(e.target.checked)}
                                    />
                                    <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                </label>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium">Screen Flashes</label>
                                <Tooltip content="Enables screen flashes when taking damage or picking up items." />
                            </div>
                            <div className="flex items-center h-10">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={screenFlashes}
                                        onChange={(e) => updateScreenFlashes(e.target.checked)}
                                    />
                                    <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                </label>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium">Gore Level</label>
                                <Tooltip content="Controls the level of blood and gibs in the game." />
                            </div>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={goreLevel}
                                onChange={(e) => updateGoreLevel(e.target.value as any)}
                            >
                                <option value="normal">Normal</option>
                                <option value="reduced">Reduced</option>
                                <option value="ultra-low">Ultra-Low</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium">Weapon Hand</label>
                                <Tooltip content="Which hand your character holds their weapon in." />
                            </div>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={weaponHand}
                                onChange={(e) => updateWeaponHand(e.target.value)}
                            >
                                <option value="-1.000000">Right</option>
                                <option value="1.000000">Left</option>
                                <option value="0.000000">Center</option>
                                <option value="2.000000">Hidden</option>
                            </select>
                        </div>
                    </div>
                </SettingsSection>

                {/* Video Settings */}
                <SettingsSection
                    title="Video Options"
                    icon={<Monitor className="size-6" />}
                    activeIconClassName="bg-green-500/10 text-green-500"
                    headerAction={
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleExportVideoSettings}
                                className="gap-2"
                            >
                                <Download className="size-4" />
                                Export
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleImportVideoSettings}
                                className="gap-2"
                            >
                                <Upload className="size-4" />
                                Import
                            </Button>
                        </div>
                    }
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Render Device</label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={renderDevice}
                                onChange={async (e) => {
                                    const val = e.target.value
                                    setRenderDevice(val)
                                    window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'Engine.Engine', 'GameRenderDevice', val)
                                    // Reload settings for the new device
                                    const settingsConfig = RENDER_DEVICE_SETTINGS[val]
                                    if (settingsConfig) {
                                        const currentSettings: Record<string, any> = {}
                                        for (const setting of settingsConfig) {
                                            const v = await window.conveyor.ini.readIniValue('UnrealTournament.ini', val, setting.key)
                                            if (setting.type === 'boolean') {
                                                currentSettings[setting.key] = v?.toLowerCase() === 'true' || v === '1'
                                            } else if (setting.type === 'number') {
                                                currentSettings[setting.key] = parseFloat(v || '0')
                                            } else {
                                                currentSettings[setting.key] = v
                                            }
                                        }
                                        setDeviceSettings(currentSettings)
                                    } else {
                                        setDeviceSettings({})
                                    }
                                }}
                            >
                                <option value="D3D9Drv.D3D9RenderDevice">Direct3D 9</option>
                                <option value="D3D11Drv.D3D11RenderDevice">Direct3D 11</option>
                                <option value="ICBINDx11Drv.ICBINDx11RenderDevice">Direct3D 11 (ICBIND)</option>
                                <option value="OpenGLDrv.OpenGLRenderDevice">OpenGL</option>
                                <option value="XOpenGLDrv.XOpenGLRenderDevice">XOpenGL</option>
                                <option value="VulkanDrv.VulkanRenderDevice">Vulkan</option>
                                <option value="SoftDrv.SoftwareRenderDevice">Software Rendering</option>
                                <option value="GlideDrv.GlideRenderDevice">3dfx Glide</option>
                                <option value="MetalDrv.MetalRenderDevice">S3 Metal</option>
                            </select>

                            {LEGACY_RENDERERS[renderDevice] && (
                                <div className="mt-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-start gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <AlertTriangle className="size-5 text-yellow-500 shrink-0 mt-0.5" />
                                    <p className="text-sm text-yellow-500/90 italic">
                                        <span className="font-semibold">{LEGACY_RENDERERS[renderDevice]}</span> is a legacy renderer and not recommended for use on modern systems.
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Resolution</label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={`${resX}x${resY}`}
                                onChange={(e) => {
                                    const [x, y] = e.target.value.split('x')
                                    setResX(x)
                                    setResY(y)
                                    window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'FullscreenViewportX', x)
                                    window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'FullscreenViewportY', y)
                                }}
                            >
                                <option value={`${window.screen.width}x${window.screen.height}`}>
                                    {window.screen.width}x{window.screen.height} (Recommended)
                                </option>
                                {getAvailableResolutions(window.screen.width, window.screen.height)
                                    .filter(res => res !== `${window.screen.width}x${window.screen.height}`)
                                    .map(res => (
                                        <option key={res} value={res}>{res}</option>
                                    ))}
                                {![`${window.screen.width}x${window.screen.height}`, ...getAvailableResolutions(window.screen.width, window.screen.height)].includes(`${resX}x${resY}`) && (
                                    <option value={`${resX}x${resY}`}>{resX}x{resY} (Custom)</option>
                                )}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium">FPS Limit (0 = Uncapped)</label>
                                <Tooltip content="Set your frames per second. In Unreal Tournament, FPS has some effect on how your game plays, but in general, we recommend setting this value to 0 (uncapped)." />
                            </div>
                            <Input
                                value={fpsLimit}
                                onChange={(e) => setFpsLimit(e.target.value)}
                                onBlur={saveVideoSettings}
                                type="number"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-medium">Netspeed</label>
                                    <Tooltip content="Netspeed is how fast your game client communicates with our servers. On our servers, this value must be set between 3,850 and 25,000. We recommend 25,000 for the best gameplay experience." />
                                </div>
                                <span className="text-sm text-muted-foreground">{netspeed}</span>
                            </div>
                            <Slider
                                min={3850}
                                max={25000}
                                step={50}
                                value={netspeed}
                                onChange={(e) => setNetspeed(parseInt(e.target.value))}
                                onMouseUp={() => window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'Engine.Player', 'ConfiguredInternetSpeed', netspeed.toString())}
                            />
                        </div>
                    </div>

                    {/* Dynamic Render Device Settings */}
                    {RENDER_DEVICE_SETTINGS[renderDevice] && (
                        <div className="col-span-1 md:col-span-2 border-t border-border pt-6 mt-2">
                            <h4 className="text-sm font-semibold mb-4 text-muted-foreground">
                                {renderDevice.split('.')[0]} Settings
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {RENDER_DEVICE_SETTINGS[renderDevice].map(setting => (
                                    <div key={setting.key} className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <label className="text-sm font-medium">{setting.label}</label>
                                            {setting.tooltip && <Tooltip content={setting.tooltip} />}
                                        </div>

                                        {setting.type === 'boolean' && (
                                            <div className="flex items-center h-10">
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                        checked={!!deviceSettings[setting.key]}
                                                        onChange={(e) => updateDeviceSetting(setting.key, e.target.checked)}
                                                    />
                                                    <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                                </label>
                                            </div>
                                        )}

                                        {setting.type === 'number' && (
                                            <div className="flex items-center gap-4">
                                                <Slider
                                                    min={setting.min ?? 0}
                                                    max={setting.max ?? 100}
                                                    step={setting.step ?? 1}
                                                    value={deviceSettings[setting.key] ?? 0}
                                                    onChange={(e) => {
                                                        // Update local state immediately for smoothness
                                                        setDeviceSettings(prev => ({ ...prev, [setting.key]: parseFloat(e.target.value) }))
                                                    }}
                                                    onMouseUp={() => {
                                                        // Commit to INI on release
                                                        updateDeviceSetting(setting.key, deviceSettings[setting.key])
                                                    }}
                                                    className="flex-1"
                                                />
                                                <span className="text-sm w-12 text-right">{deviceSettings[setting.key]}</span>
                                            </div>
                                        )}

                                        {setting.type === 'select' && (
                                            <select
                                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                value={deviceSettings[setting.key] ?? ''}
                                                onChange={(e) => updateDeviceSetting(setting.key, e.target.value)}
                                            >
                                                {setting.options?.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </SettingsSection>

                {/* Music Settings */}
                <SettingsSection
                    title="Music Settings"
                    icon={<Music className="size-6" />}
                    activeIconClassName="bg-amber-500/10 text-amber-500"
                    headerAction={
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    handleExportMusicSettings()
                                }}
                                className="gap-2"
                            >
                                <Download className="size-4" />
                                Export
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    handleImportMusicSettings()
                                }}
                                className="gap-2"
                            >
                                <Upload className="size-4" />
                                Import
                            </Button>
                        </div>
                    }
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Audio Device</label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={audioDevice}
                                onChange={async (e) => {
                                    const val = e.target.value
                                    setAudioDevice(val)
                                    window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'Engine.Engine', 'AudioDevice', val)
                                    // Reload settings for the new device
                                    const settingsConfig = AUDIO_DEVICE_SETTINGS[val]
                                    if (settingsConfig) {
                                        const currentSettings: Record<string, any> = {}
                                        for (const setting of settingsConfig) {
                                            const v = await window.conveyor.ini.readIniValue('UnrealTournament.ini', val, setting.key)
                                            if (setting.type === 'boolean') {
                                                currentSettings[setting.key] = v?.toLowerCase() === 'true' || v === '1'
                                            } else if (setting.type === 'number') {
                                                currentSettings[setting.key] = parseFloat(v || '0')
                                            } else {
                                                currentSettings[setting.key] = v
                                            }
                                        }
                                        setAudioSettings(currentSettings)
                                    } else {
                                        setAudioSettings({})
                                    }
                                }}
                            >
                                <option value="ALAudio.ALAudioSubsystem">{AUDIO_DEVICE_INFO['ALAudio.ALAudioSubsystem'].label}</option>
                                <option value="Cluster.ClusterAudioSubsystem">{AUDIO_DEVICE_INFO['Cluster.ClusterAudioSubsystem'].label}</option>
                                <option value="Galaxy.GalaxyAudioSubsystem">{AUDIO_DEVICE_INFO['Galaxy.GalaxyAudioSubsystem'].label}</option>
                            </select>

                            {AUDIO_DEVICE_INFO[audioDevice] && (
                                <div className={cn(
                                    "mt-2 p-3 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-1 duration-200",
                                    AUDIO_DEVICE_INFO[audioDevice].recommended
                                        ? "bg-green-500/10 border border-green-500/20"
                                        : audioDevice === 'Galaxy.GalaxyAudioSubsystem'
                                            ? "bg-yellow-500/10 border border-yellow-500/20"
                                            : "bg-blue-500/10 border border-blue-500/20"
                                )}>
                                    {AUDIO_DEVICE_INFO[audioDevice].recommended ? (
                                        <CheckCircle className="size-5 text-green-500 shrink-0 mt-0.5" />
                                    ) : audioDevice === 'Galaxy.GalaxyAudioSubsystem' ? (
                                        <AlertTriangle className="size-5 text-yellow-500 shrink-0 mt-0.5" />
                                    ) : (
                                        <Music className="size-5 text-blue-500 shrink-0 mt-0.5" />
                                    )}
                                    <p className={cn(
                                        "text-sm italic",
                                        AUDIO_DEVICE_INFO[audioDevice].recommended
                                            ? "text-green-500/90"
                                            : audioDevice === 'Galaxy.GalaxyAudioSubsystem'
                                                ? "text-yellow-500/90"
                                                : "text-blue-500/90"
                                    )}>
                                        {AUDIO_DEVICE_INFO[audioDevice].description}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Dynamic Audio Device Settings */}
                    {AUDIO_DEVICE_SETTINGS[audioDevice] && (
                        <div className="col-span-1 md:col-span-2 border-t border-border pt-6 mt-6">
                            <h4 className="text-sm font-semibold mb-4 text-muted-foreground">
                                {audioDevice.split('.')[0]} Settings
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {AUDIO_DEVICE_SETTINGS[audioDevice].map(setting => (
                                    <div key={setting.key} className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <label className="text-sm font-medium">{setting.label}</label>
                                            {setting.tooltip && <Tooltip content={setting.tooltip} />}
                                        </div>

                                        {setting.type === 'boolean' && (
                                            <div className="flex items-center h-10">
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                        checked={!!audioSettings[setting.key]}
                                                        onChange={(e) => updateAudioSetting(setting.key, e.target.checked)}
                                                    />
                                                    <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                                </label>
                                            </div>
                                        )}

                                        {setting.type === 'number' && (
                                            <div className="flex items-center gap-4">
                                                <Slider
                                                    min={setting.min ?? 0}
                                                    max={setting.max ?? 100}
                                                    step={setting.step ?? 1}
                                                    value={audioSettings[setting.key] ?? 0}
                                                    onChange={(e) => {
                                                        setAudioSettings(prev => ({ ...prev, [setting.key]: parseFloat(e.target.value) }))
                                                    }}
                                                    onMouseUp={() => {
                                                        updateAudioSetting(setting.key, audioSettings[setting.key])
                                                    }}
                                                    className="flex-1"
                                                />
                                                <span className="text-sm w-12 text-right">{audioSettings[setting.key]}</span>
                                            </div>
                                        )}

                                        {setting.type === 'select' && (
                                            <select
                                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                value={audioSettings[setting.key] ?? ''}
                                                onChange={(e) => updateAudioSetting(setting.key, e.target.value)}
                                            >
                                                {setting.options?.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </SettingsSection>

                {/* Binds */}
                <SettingsSection
                    title="Binds"
                    icon={<Keyboard className="size-6" />}
                    activeIconClassName="bg-purple-500/10 text-purple-500"
                    headerAction={
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleExportBinds}
                                className="gap-2"
                            >
                                <Download className="size-4" />
                                Export
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleImportBinds}
                                className="gap-2"
                            >
                                <Upload className="size-4" />
                                Import
                            </Button>
                        </div>
                    }
                >
                    <div className="space-y-8">
                        {BIND_CATEGORIES.map((category) => (
                            <div key={category.name}>
                                <h4 className="text-md font-medium mb-4 text-muted-foreground">{category.name}</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {category.binds.map((bind) => (
                                        <div key={bind.command} className="flex items-center justify-between p-3 rounded-lg bg-accent/30 border border-border">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm">{bind.label}</span>
                                                {bind.tooltip && <Tooltip content={bind.tooltip} />}
                                            </div>
                                            <div className="flex gap-2">
                                                {[0, 1].map(slot => (
                                                    <Button
                                                        key={slot}
                                                        variant="outline"
                                                        size="sm"
                                                        className={cn(
                                                            "min-w-[80px] font-mono",
                                                            editingBind?.command === bind.command && editingBind?.slot === slot && "border-blue-500 text-blue-500 animate-pulse"
                                                        )}
                                                        onClick={() => handleBindClick(bind.command, slot)}
                                                    >
                                                        {editingBind?.command === bind.command && editingBind?.slot === slot
                                                            ? 'Press Key...'
                                                            : ((Array.isArray(binds[bind.command.toLowerCase()]) ? binds[bind.command.toLowerCase()] : [])[slot] || 'None')}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </SettingsSection>
            </div >
        </div >
    )
}
