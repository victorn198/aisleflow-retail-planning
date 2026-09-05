import { describe, expect, it } from 'vitest'
import { changeDrivers, concentration, seriesStats } from './innovation'

describe('AisleFlow analytical contracts', () => {
  it('ranks changes by absolute operational impact', () => {
    const rows=changeDrivers([{name:'A',value:90,previous:100},{name:'B',value:140,previous:100}])
    expect(rows.map(row=>row.name)).toEqual(['B','A'])
    expect(rows[0].change).toBe(40)
  })

  it('measures variability from the selected series', () => {
    const stats=seriesStats([{label:'1',value:10},{label:'2',value:10},{label:'3',value:10}])
    expect(stats.mean).toBe(10)
    expect(stats.cv).toBe(0)
  })

  it('does not treat the displayed top rows as the denominator', () => {
    expect(concentration([{name:'A',value:20},{name:'B',value:10}],100).top3Share).toBe(.3)
  })
})
