export const CAP_TYPE_UTBT_CERTIFIED = 2
export const CAP_TYPE_I4GAMES = 3

export function isCertifiedCap(cap: { cap_type?: number | null }): boolean {
    return cap.cap_type === CAP_TYPE_UTBT_CERTIFIED
}
