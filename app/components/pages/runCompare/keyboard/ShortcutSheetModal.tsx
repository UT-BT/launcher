import { Modal } from '@/app/components/ui/modal'
import { SHORTCUT_SHEET } from './shortcuts'

interface ShortcutSheetModalProps {
    isOpen: boolean
    onClose: () => void
    portal: boolean
}

export function ShortcutSheetModal({ isOpen, onClose, portal }: ShortcutSheetModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Keyboard Shortcuts" maxWidth="36rem" portal={portal}>
            <dl className="run-compare-shortcuts">
                {SHORTCUT_SHEET.map(entry => (
                    <div key={entry.action} className="run-compare-shortcut">
                        <dt className="run-compare-shortcut-keys">
                            {entry.keys.map(key => <kbd key={key}>{key}</kbd>)}
                        </dt>
                        <dd>
                            <span className="text-foreground">{entry.action}</span>
                            <span className="text-muted-foreground">Or: {entry.control}</span>
                        </dd>
                    </div>
                ))}
            </dl>
        </Modal>
    )
}
