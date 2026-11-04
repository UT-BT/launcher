export interface ClockTarget {
    runTime: (t: number) => number
    masterTime: (runTime: number) => number
    slope?: (t: number) => number
}

export const RACE_TARGET: ClockTarget = {
    runTime: t => t,
    masterTime: runTime => runTime,
}
