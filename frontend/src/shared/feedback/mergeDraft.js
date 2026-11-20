
// Numbers and booleans may come back from inputs as strings: compare them as
// text so an untouched field is not mistaken for a change.
const normalize = (value) =>
  JSON.stringify(value ?? '', (_, item) =>
    typeof item === 'number' || typeof item === 'boolean'
      ? String(item)
      : (item ?? ''),
  );

export const sameValue = (a, b) => normalize(a) === normalize(b);

/**
 * Three-way merge used after a 412 (concurrent edit, clarification 15).
 * base    = record when this user started editing (form values)
 * draft   = this user's form
 * current = record saved meanwhile by someone else (form values)
 * - field unchanged in the draft      -> take the current value
 * - field unchanged by the other user -> keep the draft value
 * - both changed to the same value    -> keep it
 * - both changed to different values  -> conflict (explicit choice required)
 */
export function mergeDraft({ base, draft, current, fieldNames }) {
  const merged = { ...draft };
  const conflicts = [];
  for (const name of fieldNames) {
    if (sameValue(draft[name], base[name])) merged[name] = current[name];
    else if (
      sameValue(current[name], base[name]) ||
      sameValue(current[name], draft[name])
    )
      merged[name] = draft[name];
    else conflicts.push(name);
  }
  return { merged, conflicts };
}
