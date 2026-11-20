// WEB05 BR25: after an unknown outcome (timeout, network, 5xx) the result is
// confirmed against the API before the operation can be sent again.
// 'applied' | 'notApplied' | 'unconfirmed' (unconfirmed keeps the block).

const currentRecord = (result, productId) =>
  (Array.isArray(result) ? result : (result?.items ?? [])).find(
    (row) => row.productId === productId && !row.endedAt,
  );

/** Compares the current units with the units before the adjustment was sent. */
export async function verifyStockAdjustment(api, pending) {
  const current = currentRecord(
    await api.list({ productId: pending.recordId }),
    pending.recordId,
  );
  const before = Number(pending.before);
  const units = Number(pending.values?.units);
  if (!current || !Number.isFinite(before) || !Number.isFinite(units))
    return 'unconfirmed';
  const sign = pending.values.direction === 'DECREASE' ? -1 : 1;
  const now = Number(current.availableUnits);
  if (now === before + sign * units) return 'applied';
  if (now === before) return 'notApplied';
  return 'unconfirmed'; // changed by someone else: cannot tell
}

/** Start tracking was applied when the product has a current stock record. */
export async function verifyStockStart(api, pending) {
  const productId = String(pending.values?.productId ?? '').trim();
  if (!productId) return 'unconfirmed';
  const current = currentRecord(await api.list({ productId }), productId);
  return current ? 'applied' : 'notApplied';
}