export type GuideBlock =
    | { kind: 'text'; text: string }
    | { kind: 'list'; items: string[] }
    | { kind: 'launcher' }

export interface GuideStep {
    id: string
    title: string
    desktopOnly: boolean
    blocks: GuideBlock[]
}

export const DESKTOP_LAUNCHER_URL = 'https://github.com/UT-BT/launcher/releases/latest'

const text = (value: string): GuideBlock => ({ kind: 'text', text: value })
const list = (...items: string[]): GuideBlock => ({ kind: 'list', items })

export const GUIDE_STEPS: GuideStep[] = [
    {
        id: 'requirements',
        title: 'Requirements',
        desktopOnly: false,
        blocks: [
            list(
                'Windows 10 version 2004 or later. Windows Graphics Capture, which grabs the cam windows, needs it.',
                'The current OBS Studio release. Application Audio Capture, which picks up each cam\'s sound, needs OBS 28 or newer.',
                'The desktop launcher, for the cam tool. Without it you can still use the scenes and the controls from the website, but you have to run the four spectator cams yourself.',
            ),
            { kind: 'launcher' },
        ],
    },
    {
        id: 'kit',
        title: 'Get the kit',
        desktopOnly: false,
        blocks: [
            text('The kit is your personal set of OBS files. Open the Setup tab, check the kit folder in the Kit card (the default is C:\\UTBT-StreamKit) and press Download and extract kit in the desktop launcher, or Download kit on the website.'),
            list(
                'In the desktop launcher the kit is extracted into the kit folder for you.',
                'On the website it downloads as a ZIP. Unzip it into the kit folder you chose, so that stinger.webm ends up directly inside it. The scene collection looks for the stinger at that exact path.',
            ),
            text('The kit holds UTBT-StreamKit-Scenes.json, the UTBT-StreamKit-Profile folder, stinger.webm, kit.json and a short README. It never contains a stream key.'),
        ],
    },
    {
        id: 'import',
        title: 'Import the scene collection and the profile',
        desktopOnly: false,
        blocks: [
            list(
                'In OBS choose Scene Collection > Import and pick UTBT-StreamKit-Scenes.json from the kit folder. Then open the Scene Collection menu and switch to the imported collection.',
                'Choose Profile > Import and pick the UTBT-StreamKit-Profile folder. Then open the Profile menu and switch to the imported profile.',
            ),
            text('The collection has twelve scenes: Starting Soon, Match Preview, Pick & Ban, Betting, Match, Intermission, Next Map, Post-match, Standings, BRB, Ending and Caster Cam. The profile sets 1920×1080 at 60 fps, Simple output mode, 8000 kbps video and 160 kbps audio.'),
        ],
    },
    {
        id: 'encoder',
        title: 'Pick an encoder',
        desktopOnly: false,
        blocks: [
            text('The kit leaves the encoder to you, because it depends on your graphics card.'),
            list(
                'Open Settings > Output in OBS. Choose a hardware encoder when you have one: NVENC (NVIDIA), AMF (AMD) or QSV (Intel).',
                'If none is offered, or the stream drops frames, use x264.',
                'Keep the video bitrate at 8000 kbps.',
                'Under Settings > Stream, keep "Ignore streaming service setting recommendations" ticked, or OBS may lower the bitrate for you.',
            ),
        ],
    },
    {
        id: 'stream-key',
        title: 'Add your stream key in OBS',
        desktopOnly: false,
        blocks: [
            text('Open Settings > Stream in OBS, choose your service, and paste your own stream key. The kit never contains a key and this site never asks for one, so this step is always yours.'),
        ],
    },
    {
        id: 'dock',
        title: 'Add the Stream tab as an OBS dock',
        desktopOnly: false,
        blocks: [
            list(
                'In OBS choose Docks > Custom Browser Docks.',
                'Give the dock a name such as UTBT Stream, and paste the address of this Stream tab as its URL. Press Apply.',
                'Sign in with Discord inside the dock. The dock is its own browser, so it does not share your login with the website.',
            ),
            text('With the dock open you can run the whole show without leaving OBS.'),
        ],
    },
    {
        id: 'cams',
        title: 'Launch the cams',
        desktopOnly: true,
        blocks: [
            text('In the desktop launcher open the Cams tab. It needs the game install path from Settings > Game Installation. Each team\'s server is detected from the server list, and you can override it, either with a server from the list or with an address you type.'),
            list(
                'Every player in the lineup needs a linked Discord account. Fix missing players in the Match tab first.',
                'The cams run at 120 fps by default, which keeps a 60 fps stream smooth. On a weaker PC choose 60 under Cam FPS in the Cams tab, before you launch or restart the cams.',
                'Press Launch cams. Four spectator windows open, one per lineup slot.',
                'In OBS, open the Match scene and check that the four captures Cam A1, Cam A2, Cam B1 and Cam B2 each show their window. They bind by the window titles UTBT Cam A1, UTBT Cam A2, UTBT Cam B1 and UTBT Cam B2.',
                'Check the four application audio captures in the mixer. Each one should move when its cam has sound.',
                'Check the Discord capture, so your casters are heard (the Discord desktop app has to be running), and your mic.',
            ),
            text('If a cam shows a "Wrong player" chip, the lineup changed after it launched. Use Restart on that cam, or Relaunch cams. Stop all closes every cam.'),
        ],
    },
    {
        id: 'scene-urls',
        title: 'Repair or add a single source by hand',
        desktopOnly: false,
        blocks: [
            text('The Scenes card on the Setup tab lists the address of each of your twelve scenes, with a copy button and a live preview.'),
            list(
                'To repair a source, open its properties in OBS and paste the copied address into the URL field.',
                'To add one, choose Add > Browser in OBS, paste the address, and set the size to 1920×1080 at 60 fps.',
            ),
            text('Visual changes reach OBS on their own. You never need to import again for them.'),
        ],
    },
    {
        id: 'running',
        title: 'Running a match',
        desktopOnly: false,
        blocks: [
            list(
                'Match tab, Current match: your assigned matches are listed, and Next match moves to the following one. The current match drives your scenes.',
                'Match tab, Lineup: check the suggested lineup or type a name. Swap exchanges a team\'s left and right players when they are the wrong way round.',
                'Match tab, Streaming on: choose My channel, UTBT channel or Other URL for where viewers are sent. Your own Twitch channel is saved in the Own Twitch channel card on the Setup tab.',
                'Match tab, Countdown: override the countdown when the match starts late.',
                'Score tab: a match goes live by itself when its pick and ban ends. When a match starts without a pick and ban, press Match live so the overlay goes live. Correct the score by hand when the game data is wrong.',
                'Studio tab: name the casters for the current match, set the BRB message, and turn the webcam frame on or off. The Caster Webcam source in OBS starts empty, so point it at your camera first, or leave the frame off when you have no camera.',
            ),
        ],
    },
    {
        id: 'audio-levels',
        title: 'Audio levels',
        desktopOnly: false,
        blocks: [
            text('The kit presets the levels for you, so you only nudge them. In the OBS Audio Mixer, healthy meters look like this: voices (Discord and your mic) peak well into the yellow and never touch red. The game bed sits lower, so the voices stay clear over it.'),
            list(
                'The game drowns the voices: turn the cams down in OBS, or lower Cam volume in the Cams tab and relaunch the cams.',
                'The casters in Discord are too quiet: turn Discord up.',
                'Your own voice is too quiet or too loud: move the mic fader.',
            ),
            text('Leave the filters alone. They are already set up for you.'),
            text('What the kit presets:'),
            list(
                'The four cams are at −15 dB.',
                'Discord and your mic are at 0 dB.',
                'The scene cues (Starting Soon, Intermission and Post-match) are at −6 dB, and the Pick & Ban sound effects are at −35 dB.',
                'The game audio ducks under Discord and the mic, so the cams get quieter by themselves while someone talks.',
                'Limiters on the cams, Discord, the mic and the cues stop anything from clipping.',
            ),
        ],
    },
    {
        id: 'out-of-date',
        title: 'When the out-of-date banner shows',
        desktopOnly: false,
        blocks: [
            text('The Kit card on the Setup tab shows a banner when the kit structure has changed since your last download, or when you never downloaded one.'),
            list(
                'Download the kit again.',
                'In OBS choose Scene Collection > Import for UTBT-StreamKit-Scenes.json, and Profile > Import for the UTBT-StreamKit-Profile folder.',
            ),
            text('Visual changes to the scenes need nothing. Only a structure change asks for a re-import.'),
        ],
    },
    {
        id: 'troubleshooting',
        title: 'Troubleshooting',
        desktopOnly: false,
        blocks: [
            list(
                'A capture does not bind: launch the cams first, then wait a few seconds. In the capture\'s properties pick the window called UTBT Cam A1 (or A2, B1, B2) by hand. If a cam shows "Not titled yet" in the Cams tab, its window has not been titled, so use Restart on that cam.',
                'No cam audio: check that the application audio capture for that cam points at the window with the same title, and that the cam window is not muted in the Windows volume mixer. Application Audio Capture needs OBS 28 or newer.',
                'A password prompt shows in every cam: the server is locked. Type its password under that team\'s server in the Cams tab, then relaunch the cams.',
                'The cams look darker on stream than in the game: with the D3D9 or OpenGL renderer the cam tool switches the cams to shader gamma, so your Brightness setting is drawn into the picture OBS captures. Relaunch the cams after a launcher update. If a cam still looks dark, raise Brightness in the game\'s video settings and relaunch, or add a Color Correction filter to that cam capture in OBS.',
                'The stinger shows black instead of transparent: check that stinger.webm sits directly in the kit folder, and that the transition path points at it. Download the kit again to restore the file.',
                'Windows Graphics Capture is not available: update Windows to version 2004 or later. On a laptop with two graphics cards, run OBS and the game on the same one.',
            ),
        ],
    },
]

export function guideStepIds(): string[] {
    return GUIDE_STEPS.map(step => step.id)
}
