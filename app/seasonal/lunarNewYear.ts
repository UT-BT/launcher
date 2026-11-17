const FIRST_YEAR = 2026

const MONTH_DAY: ReadonlyArray<readonly [number, number]> = [
    [2, 17],
    [2, 6],
    [1, 26],
    [2, 13],
    [2, 3],
    [1, 23],
    [2, 11],
    [1, 31],
    [2, 19],
    [2, 8],
    [1, 28],
    [2, 15],
    [2, 4],
    [1, 24],
    [2, 12],
    [2, 1],
    [1, 22],
    [2, 10],
    [1, 30],
    [2, 17],
    [2, 6],
    [1, 26],
    [2, 14],
    [2, 2],
    [1, 23],
]

export const LUNAR_NEW_YEAR_YEARS: readonly number[] = MONTH_DAY.map((_, index) => FIRST_YEAR + index)

export function lunarNewYearsDay(year: number): Date | null {
    const monthDay = MONTH_DAY[year - FIRST_YEAR]
    return monthDay ? new Date(year, monthDay[0] - 1, monthDay[1]) : null
}
