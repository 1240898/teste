const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const sameValue = (left, right) =>
  JSON.stringify(left) === JSON.stringify(right);

const escapeToken = (token) =>
  String(token).replace(/~/g, '~0').replace(/\//g, '~1');

/**
 * Path of a list of tokens: a string is a property, { elementId } an element of
 * /content/elements matched by id, e.g.
 * ["content", { elementId: "line-arm-2" }, "placement", "position", "x"]
 *   -> "/content/elements[line-arm-2]/placement/position/x".
 */
export function toPath(tokens) {
  return tokens
    .map((token) =>
      typeof token === 'object'
        ? `/elements[${token.elementId}]`
        : `/${escapeToken(token)}`,
    )
    .join('');
}

/** True when one token list is a prefix of the other (same or nested path). */
export function overlaps(left, right) {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1)
    if (!sameValue(left[index], right[index])) return false;
  return true;
}

function elementsById(elements) {
  if (!Array.isArray(elements)) return null;
  const map = new Map();
  for (const element of elements) {
    if (!isObject(element) || typeof element.id !== 'string') return null;
    if (map.has(element.id)) return null;
    map.set(element.id, element);
  }
  return map;
}

function walk(before, after, tokens, changes) {
  if (sameValue(before, after)) return;
  if (isObject(before) && isObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys)
      walk(before[key], after[key], [...tokens, key], changes);
    return;
  }
  changes.push({
    path: toPath(tokens),
    tokens,
    kind: before === undefined ? 'add' : after === undefined ? 'remove' : 'set',
    before,
    after,
  });
}

/**
 * D16: change set from `from` to `to` (each { name, content }). One change per
 * path: /name; every leaf outside elements; elements matched BY ID (added,
 * removed, or changed leaves). Other arrays are compared as a whole. When the
 * elements have no unique ids, the whole elements array is one leaf.
 * Pure: no React, no HTTP.
 */
export function compareConfigurations(from, to) {
  const changes = [];
  if (from?.name !== to?.name)
    changes.push({
      path: '/name',
      tokens: ['name'],
      kind: 'set',
      before: from?.name,
      after: to?.name,
    });
  const before = isObject(from?.content) ? from.content : {};
  const after = isObject(to?.content) ? to.content : {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (key !== 'elements') {
      walk(before[key], after[key], ['content', key], changes);
      continue;
    }
    const left = elementsById(before.elements);
    const right = elementsById(after.elements);
    if (!left || !right) {
      walk(before.elements, after.elements, ['content', 'elements'], changes);
      continue;
    }
    for (const [id, element] of left) {
      const tokens = ['content', { elementId: id }];
      if (!right.has(id))
        changes.push({
          path: toPath(tokens),
          tokens,
          kind: 'remove',
          before: element,
          after: undefined,
        });
      else walk(element, right.get(id), tokens, changes);
    }
    for (const [id, element] of right)
      if (!left.has(id)) {
        const tokens = ['content', { elementId: id }];
        changes.push({
          path: toPath(tokens),
          tokens,
          kind: 'add',
          before: undefined,
          after: element,
        });
      }
  }
  return { changes };
}

/** Value at a token path (undefined when absent). */
export function valueAt(document, tokens) {
  let current = document;
  for (const token of tokens) {
    if (current === undefined || current === null) return undefined;
    if (typeof token === 'object')
      current = Array.isArray(current.elements)
        ? current.elements.find((element) => element?.id === token.elementId)
        : undefined;
    else current = current[token];
  }
  return current;
}