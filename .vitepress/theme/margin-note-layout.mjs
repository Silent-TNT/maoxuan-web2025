/**
 * 将发生碰撞的连续页边注作为一组，在锚点上下平衡分布。
 * 稀疏注释保持原位；密集组只在不撞到上一个组和栏顶的范围内上移。
 */
export function balanceMarginNotePositions(
  items,
  { gap = 14, minTop = 0, maxUpShift = 240 } = {},
) {
  if (items.length === 0) return []

  const positions = new Array(items.length)
  const groups = []
  let groupStart = 0

  positions[0] = Math.max(minTop, items[0].rawTop)

  for (let index = 1; index < items.length; index += 1) {
    const previousBottom = positions[index - 1] + items[index - 1].height + gap
    const rawTop = Math.max(minTop, items[index].rawTop)

    if (rawTop < previousBottom) {
      positions[index] = previousBottom
    } else {
      groups.push([groupStart, index - 1])
      groupStart = index
      positions[index] = rawTop
    }
  }
  groups.push([groupStart, items.length - 1])

  let previousGroupBottom = minTop - gap
  groups.forEach(([start, end]) => {
    if (end > start) {
      let minDrift = Number.POSITIVE_INFINITY
      let maxDrift = Number.NEGATIVE_INFINITY

      for (let index = start; index <= end; index += 1) {
        const drift = positions[index] - items[index].rawTop
        minDrift = Math.min(minDrift, drift)
        maxDrift = Math.max(maxDrift, drift)
      }

      // 取偏移区间的中点，让组内最靠前和最靠后的注释共同承担距离。
      const balancedShift = Math.max(0, (minDrift + maxDrift) / 2)
      const availableAbove = Math.max(
        0,
        positions[start] - (previousGroupBottom + gap),
      )
      const shift = Math.min(balancedShift, availableAbove, maxUpShift)

      for (let index = start; index <= end; index += 1) {
        positions[index] -= shift
      }
    }

    previousGroupBottom = positions[end] + items[end].height
  })

  return positions
}
