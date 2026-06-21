export interface TeamDisplay {
    name: string
    accent: string
}

export function getTeamDisplay(team: number | null | undefined): TeamDisplay {
    if (team === 0) return { name: 'Red', accent: 'text-red-300' }
    if (team === 1) return { name: 'Blue', accent: 'text-blue-300' }
    return { name: 'Unknown', accent: 'text-muted-foreground' }
}
