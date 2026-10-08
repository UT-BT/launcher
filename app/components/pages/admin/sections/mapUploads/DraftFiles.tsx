import { Code2, FileArchive, FileQuestion, FileText, Image, Map as MapIcon, Music, Volume2, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DraftFile, FileKind } from '@/app/utils/mapUploadTypes'
import { DISPOSITION_LABEL, FILE_KIND_LABEL, countLabel, fileReason } from './reportLabels'
import { dispositionCounts, shippedBytes, sortFiles } from './reportView'
import { formatSize } from './driftView'
import { IconTile, Panel } from './Panel'
import { ToneChip } from './ToneChip'

const KIND_ICON: Record<FileKind, LucideIcon> = {
  map: MapIcon,
  texture: Image,
  sound: Volume2,
  music: Music,
  code: Code2,
  companion: FileText,
  other: FileQuestion,
}

function FileRow({ file }: { file: DraftFile }) {
  const disposition = DISPOSITION_LABEL[file.disposition]
  const dropped = file.disposition === 'dropped'
  const reason = file.disposition === 'install' && !file.reason ? null : fileReason(file)
  return (
    <li className={cn('flex items-center gap-3 px-4 py-2.5', dropped && 'opacity-60')}>
      <IconTile icon={KIND_ICON[file.kind]} tone={file.kind === 'map' ? 'accent' : 'muted'} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-[13px] text-foreground" title={file.file}>{file.file}</p>
        <p className="text-xs leading-snug text-muted-foreground">
          <span>{FILE_KIND_LABEL[file.kind]}</span>
          <span className="text-muted-foreground/50"> · </span>
          <span className="tabular-nums">{formatSize(file.size)}</span>
          {reason && <><span className="text-muted-foreground/50"> · </span><span>{reason}</span></>}
        </p>
      </div>
      <ToneChip tone={disposition.tone}>{disposition.label}</ToneChip>
    </li>
  )
}

export function DraftFiles({ files }: { files: DraftFile[] }) {
  const counts = dispositionCounts(files)
  const shipped = shippedBytes(files)
  return (
    <Panel
      title="Files"
      icon={FileArchive}
      meta={`${countLabel(files.length, 'file')} in the archive${shipped > 0 ? ` · ${formatSize(shipped)} to install` : ''}`}
      actions={counts.map(({ disposition, count }) => (
        <ToneChip key={disposition} tone={DISPOSITION_LABEL[disposition].tone}>
          <span className="tabular-nums">{count}</span> {DISPOSITION_LABEL[disposition].summary}
        </ToneChip>
      ))}
    >
      <ul className="divide-y divide-hairline/5">
        {sortFiles(files).map((file) => <FileRow key={file.file} file={file} />)}
      </ul>
    </Panel>
  )
}
