
export interface BindCategory {
    name: string
    binds: { label: string; command: string; tooltip?: string }[]
}

export const ALIAS_DEFINITIONS: Record<string, string> = {
    'cpsuicide': 'suicide|mutate loadcp|onrelease mutate nocp|onrelease suicide',
    'rocketjump': 'switchweapon 9 | button bfire | fire | onrelease jump',
    'hammerjump': 'getweapon ImpactHammer | Button bFire | Fire | OnRelease Jump',
    'slidejump': 'Button bRun | OnRelease Jump',
}

export const BIND_CATEGORIES: BindCategory[] = [
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
            { label: 'Walk Jump', command: 'walking|jump', tooltip: 'Walk Jumps are a special bind in Unreal Tournament that let you jump with less height than a regular jump, which can be useful for gaining time on maps. If you have jumpboots, then walk jump will allow you to jump without using a boot jump.' },
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
            { label: 'Set Checkpoint', command: 'mutate checkpoint', tooltip: 'Sets a checkpoint at your current location. You will respawn here if you die.' },
            { label: 'Remove Checkpoints', command: 'mutate nocheckpoint', tooltip: 'Removes all your checkpoints from the map.' },
            { label: 'Teleport Forward', command: 'mutate tp', tooltip: 'Teleports you forward in the map. This will set you on a checkpoint run.' },
            { label: 'Ghost', command: 'mutate ghost', tooltip: 'Allows you to ghost through maps. This will set you on a checkpoint run.' },
            { label: 'Fly', command: 'mutate fly', tooltip: 'Allows you to fly through maps. This will set you on a checkpoint run.' },
            { label: 'Walk', command: 'mutate walk', tooltip: 'Sets you back to a walking state.' },
        ]
    },
    {
        name: 'Custom Aliases',
        binds: [
            { label: 'Hammer Jump', command: 'hammerjump', tooltip: 'Perfect imapct hammer jump height every time.' },
            { label: 'Rocket Jump', command: 'rocketjump', tooltip: 'Perfect rocket jump every time.' },
            { label: 'Slide Jump', command: 'slidejump', tooltip: 'Special bind to allow you to get a normal jump during an ice slide' },
            { label: 'Load CP, Spawn, Remove CP', command: 'cpsuicide', tooltip: 'Allows you to load your CP but remove them after you spawn. Useful for setting up obstacles quickly. Usage: hold the bind to suicide, respawn, set up the mover and release to suicide.' },
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

export const gcd = (a: number, b: number): number => {
    return b === 0 ? a : gcd(b, a % b)
}

export const getAvailableResolutions = (nativeWidth: number, nativeHeight: number): string[] => {
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

export interface RenderDeviceSetting {
    key: string
    label: string
    type: 'boolean' | 'number' | 'select' | 'color'
    options?: { label: string; value: string | number }[]
    min?: number
    max?: number
    step?: number
    tooltip?: string
    section?: string
}

export const RENDER_DEVICE_SETTINGS: Record<string, RenderDeviceSetting[]> = {
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

export const AUDIO_DEVICE_SETTINGS: Record<string, RenderDeviceSetting[]> = {
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

export const LEGACY_RENDERERS: Record<string, string> = {
    'SoftDrv.SoftwareRenderDevice': 'Software Rendering',
    'GlideDrv.GlideRenderDevice': '3dfx Glide',
    'MetalDrv.MetalRenderDevice': 'S3 Metal',
}

export const AUDIO_DEVICE_INFO: Record<string, { label: string; description: string; recommended?: boolean }> = {
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
