import {
  compareConfigurations,
  overlaps,
  sameValue,
  valueAt,
} from './compareConfigurations.js';
import { parseConfigurationText } from './configurationJson.js';

const clone = (value) =>
  value === undefined ? undefined : JSON.parse(JSON.stringify(value));

function findElement(document, elementId) {
  return Array.isArray(document?.content?.elements)
    ? document.content.elements.find((element) => element?.id === elementId)
    : undefined;
}

/**
 * Applies one change of the Manager's draft to `target` ({ name, content }).
 * A change inside an element that no longer exists in `target` restores the
 * whole element as it is in the draft (the Manager chose "keep mine").
 */
function applyChange(target, change, draft) {
  const { tokens } = change;
  const elementIndex = tokens.findIndex((token) => typeof token === 'object');
  if (elementIndex === 1) {
    const { elementId } = tokens[1];
    target.content.elements = Array.isArray(target.content.elements)
      ? target.content.elements
      : [];
    const elements = target.content.elements;
    const position = elements.findIndex((element) => element?.id === elementId);
    if (tokens.length === 2) {
      if (change.kind === 'remove') {
        if (position >= 0) elements.splice(position, 1);
      } else if (position >= 0) elements[position] = clone(change.after);
      else elements.push(clone(change.after));
      return;
    }
    if (position < 0) {
      const fromDraft = findElement(draft, elementId);
      if (fromDraft) elements.push(clone(fromDraft));
      return;
    }
    setAt(elements[position], tokens.slice(2), change);
    return;
  }
  setAt(target, tokens, change);
}

function setAt(container, tokens, change) {
  let current = container;
  for (const token of tokens.slice(0, -1)) {
    if (current[token] === null || typeof current[token] !== 'object')
      current[token] = {};
    current = current[token];
  }
  const last = tokens.at(-1);
  if (change.kind === 'remove' || change.after === undefined)
    delete current[last];
  else current[last] = clone(change.after);
}

/**
 * Three-way rebase (D16, clarification 15). The next save is built ON THE
 * RELOADED RECORD: candidate = copy of `latest`; each change of draft - base is
 * re-applied when the other user did not change the same or an overlapping
 * path; the same value needs nothing; a different value is a conflict that the
 * Manager resolves (keep mine / keep theirs). New draft elements are appended
 * after the elements of latest. Pure: no React, no HTTP.
 *
 * @param {{ name: string, content: object }} base Record as it was loaded.
 * @param {{ name: string, text: string }} draft Editor state.
 * @param {{ name: string, content: object }} latest Reloaded record.
 */
export function rebaseDraft(base, draft, latest) {
  const parsed = parseConfigurationText(draft.text);
  if (!parsed.ok) return { status: 'rebase-impossible', error: parsed.error };
  const mineDocument = { name: draft.name, content: parsed.value };
  const latestDocument = { name: latest.name, content: clone(latest.content) };
  const mine = compareConfigurations(base, mineDocument).changes;
  const theirs = compareConfigurations(base, latestDocument).changes;
  const candidate = clone(latestDocument);
  const applied = [];
  const conflicts = [];
  for (const change of mine) {
    const overlapping = theirs.filter((other) =>
      overlaps(other.tokens, change.tokens),
    );
    if (!overlapping.length) {
      applyChange(candidate, change, mineDocument);
      applied.push(change);
      continue;
    }
    const identical =
      overlapping.length === 1 &&
      overlapping[0].path === change.path &&
      sameValue(overlapping[0].after, change.after);
    if (identical) continue;
    conflicts.push({
      path: change.path,
      base: change.before,
      mine: change.after,
      theirs: valueAt(latestDocument, change.tokens),
      change,
    });
  }
  return {
    status: 'ok',
    candidate,
    applied,
    theirs,
    conflicts,
    draft: mineDocument,
  };
}

/**
 * Candidate after the Manager's decisions: "theirs" keeps the reloaded value
 * (already in the candidate); "mine" re-applies the Manager's change.
 * @param {ReturnType<typeof rebaseDraft>} result
 * @param {Record<string, 'mine'|'theirs'>} resolutions keyed by conflict path
 */
export function applyResolutions(result, resolutions = {}) {
  const candidate = clone(result.candidate);
  for (const conflict of result.conflicts)
    if (resolutions[conflict.path] === 'mine')
      applyChange(candidate, conflict.change, result.draft);
  const unresolved = result.conflicts.filter(
    (conflict) => !['mine', 'theirs'].includes(resolutions[conflict.path]),
  ).length;
  return { ...result, candidate, unresolved };
}