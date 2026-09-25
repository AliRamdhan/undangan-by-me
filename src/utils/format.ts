/** Percent of `n` over `d`, rounded; 0 when `d` is 0. */
export const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0)

export const nf = new Intl.NumberFormat('id-ID')
