import { cn } from '@/lib/utils'
import { PICK_BAN_TONES } from '@/app/components/broadcast/broadcastTone'
import type { UpNextView } from './intermissionView'

export function UpNextLine({ upNext }: { upNext: UpNextView }) {
    return (
        <p data-up-next className={cn('mt-[26px] text-[44px] font-black italic uppercase leading-none', PICK_BAN_TONES[upNext.tone].text)}>
            {upNext.text}
        </p>
    )
}
