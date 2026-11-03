export const NUMERIC_TABLE = '@container/numbers'

export const NUMERIC_CELL = '@max-md/numbers:px-1.5 @max-md/numbers:tracking-normal'

export const NUMERIC_TEXT = '@max-md/numbers:font-sans @max-md/numbers:tracking-tight'

export const NUMERIC_STRONG_TEXT = `${NUMERIC_TEXT} @max-md/numbers:text-xs`

export function NumericHeader({ full, short }: { full: string; short: string }) {
    return (
        <>
            <span className="@max-md/numbers:hidden">{full}</span>
            <abbr title={full} className="hidden no-underline @max-md/numbers:inline">{short}</abbr>
        </>
    )
}
