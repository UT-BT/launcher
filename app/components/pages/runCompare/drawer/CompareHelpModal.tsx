import type { MouseEvent, ReactNode } from 'react'
import { openExternal } from '@/app/platform'
import { Modal } from '@/app/components/ui/modal'
import { MAX_COMPARE_RUNS } from '../url/compareUrl'
import { MAX_TEAM_RUNS } from '../model/teamModel'

export const COMPARE_HELP_TITLE = 'How Compare Works'

interface HelpEntry {
    term: string
    text: ReactNode
}

function ExternalAnchor({ href, children }: { href: string; children: ReactNode }) {
    const open = (event: MouseEvent<HTMLAnchorElement>) => {
        event.preventDefault()
        openExternal(href)
    }
    return <a href={href} target="_blank" rel="noopener noreferrer" className="run-compare-help-link" onClick={open}>{children}</a>
}

const STEPS: HelpEntry[] = [
    { term: 'Pick a map', text: 'Search for it, or start from a recent world record.' },
    { term: 'Select runs', text: `Tick the runs you want, up to ${MAX_COMPARE_RUNS} solo runs or ${MAX_TEAM_RUNS} team runs, then press Compare.` },
    { term: 'Watch them race', text: 'The videos play side by side in sync, and the graph under them shows each run’s gap to its baseline as it plays.' },
    { term: 'Baseline', text: 'The run every other run is measured against: the fastest one unless you set another from its ⋯ menu.' },
]

const VIDEOS: HelpEntry[] = [
    {
        term: 'UTRecorder',
        text: <>Recorded with <ExternalAnchor href="https://recorder.utbt.net">UTRecorder</ExternalAnchor>. Frame accurate from start to finish, allowing for exact sync.</>,
    },
    {
        term: 'DemoConverter',
        text: <>Recorded with <ExternalAnchor href="https://democonverter.com">DemoConverter</ExternalAnchor>. Legacy recording technology that may require custom syncing.</>,
    },
    { term: 'No video', text: 'The run still joins the comparison as a line in the graph and a row in the tables. Tagged “Graph only”.' },
]

const DATA: HelpEntry[] = [
    { term: 'Full replay', text: 'The player’s position through the whole run: a smooth gap curve, sector times, the speed chart and Same Spot sync.' },
    { term: 'Checkpoints only', text: 'Only the times at the map’s checkpoints, so the gap updates at each checkpoint. Tagged “Checkpoints only”.' },
    { term: 'Final time only', text: 'Only the finish time, so the gap shows at the end of the run. Tagged “Final time only”.' },
    { term: 'Red and blue', text: 'On maps played from both sides each side has its own route, so each side gets its own baseline.' },
]

function HelpList({ title, lead, entries }: { title: string; lead?: string; entries: readonly HelpEntry[] }) {
    return (
        <section className="run-compare-help-section">
            <h3 className="run-compare-help-title">{title}</h3>
            {lead && <p className="run-compare-help-lead">{lead}</p>}
            <dl className="run-compare-help-list">
                {entries.map(entry => (
                    <div key={entry.term} className="run-compare-help-entry">
                        <dt>{entry.term}</dt>
                        <dd>{entry.text}</dd>
                    </div>
                ))}
            </dl>
        </section>
    )
}

interface CompareHelpModalProps {
    isOpen: boolean
    onClose: () => void
}

export default function CompareHelpModal({ isOpen, onClose }: CompareHelpModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={COMPARE_HELP_TITLE} maxWidth="38rem" footer={null}>
            <div role="document" tabIndex={0} aria-label={COMPARE_HELP_TITLE} className="run-compare-help">
                <HelpList title="Comparing runs" entries={STEPS} />
                <HelpList title="Videos" lead="Runs can have a video from one of two sources, or none." entries={VIDEOS} />
                <HelpList title="Run data" lead="How much a run can be analysed depends on what was saved with it." entries={DATA} />
            </div>
        </Modal>
    )
}
