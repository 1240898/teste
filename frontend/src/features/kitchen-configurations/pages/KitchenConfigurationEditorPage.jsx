import { useId, useMemo, useRef, useState } from 'react';
import FeedbackMessage from '../../../shared/feedback/FeedbackMessage.jsx';
import { toFeedback } from '../../../shared/feedback/errorMapper.js';
import { useSubmission } from '../../../shared/hooks/useSubmission.js';
import { useLocale } from '../../../shared/locale/localeContext.js';
import ConcurrentChangePanel from '../components/ConcurrentChangePanel.jsx';
import JsonContentEditor from '../components/JsonContentEditor.jsx';
import ValidationIssueList from '../components/ValidationIssueList.jsx';
import {
  formatConfiguration,
  parseConfigurationText,
  readImportFile,
} from '../configurationJson.js';
import {
  DUPLICATE_NAME_MESSAGE,
  STALE_VERSION_MESSAGE,
} from '../kitchenConfigurationApi.js';
import { applyResolutions, rebaseDraft } from '../rebaseDraft.js';

const NO_CONFLICT = Object.freeze({
  phase: 'none', // "none" | "conflict" | "reviewing"
  latest: null,
  rebase: null,
  resolutions: {},
  continued: false,
  reviewAcknowledged: false,
});
const IMPORT_MESSAGES = {
  extension: 'kitchenImportExtension',
  size: 'kitchenImportSize',
  read: 'kitchenImportRead',
};

/**
 * Create / edit page (SD 1, SD 2). Every piece of editor state (name, text,
 * version, issues, base and the concurrent-change state) is React state of
 * this component; nothing depends on the language, so a PT/EN switch only
 * re-renders the texts (BR 21, D17). The typed or imported text is kept after
 * any failure (WEB04 AC 5) and the back end is the only content validator.
 */
export default function KitchenConfigurationEditorPage({
  api,
  mode,
  initial = null,
  onSaved,
}) {
  const { t } = useLocale();
  const prefix = useId();
  const fileInput = useRef(null);
  const [name, setName] = useState(initial?.name ?? '');
  const [text, setText] = useState(
    initial ? formatConfiguration(initial.content) : '',
  );
  const [version, setVersion] = useState(initial?.version ?? null);
  const [status, setStatus] = useState(initial?.status ?? 'INACTIVE');
  // Record as it was loaded: the base of the three-way rebase (D16).
  const [base, setBase] = useState(
    initial ? { name: initial.name, content: initial.content } : null,
  );
  const [syntaxError, setSyntaxError] = useState(null);
  const [issues, setIssues] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [nameError, setNameError] = useState(null);
  const [concurrency, setConcurrency] = useState(NO_CONFLICT);
  const { isSubmitting, submit } = useSubmission();

  const rebase = useMemo(
    () =>
      concurrency.rebase?.status === 'ok'
        ? applyResolutions(concurrency.rebase, concurrency.resolutions)
        : concurrency.rebase,
    [concurrency.rebase, concurrency.resolutions],
  );
  const { phase, continued, reviewAcknowledged } = concurrency;
  const readOnly = phase === 'reviewing' && !continued;
  // While a request is pending the draft is frozen: a 200 loads the stored
  // record, so text typed meanwhile would otherwise be silently dropped.
  const locked = readOnly || isSubmitting;
  const canSave =
    !isSubmitting &&
    (phase === 'none' ||
      (phase === 'reviewing' && continued && reviewAcknowledged));

  function loadRecord(record) {
    setName(record.name);
    setText(formatConfiguration(record.content));
    setVersion(record.version);
    setStatus(record.status);
    setBase({ name: record.name, content: record.content });
  }

  function parseOrReport() {
    const parsed = parseConfigurationText(text);
    setSyntaxError(parsed.ok ? null : parsed.error);
    return parsed.ok ? parsed.value : null;
  }

  function handleSaveError(error) {
    if (error?.status === 422) {
      const details = error.details ?? [];
      setIssues(details);
      setFeedback({
        severity: 'error',
        messageKey: 'kitchenContentInvalid',
        values: { count: details.length },
      });
    } else if (
      error?.status === 409 &&
      error.message === STALE_VERSION_MESSAGE
    ) {
      // The draft (name + text) and the base stay; Save is disabled (SD 2).
      setConcurrency({ ...NO_CONFLICT, phase: 'conflict' });
    } else if (
      error?.status === 409 &&
      error.message === DUPLICATE_NAME_MESSAGE
    ) {
      setNameError('kitchenNameTaken');
    } else if (error?.status === 404) {
      setFeedback({
        severity: 'error',
        messageKey: 'kitchenConfigurationGone',
      });
    } else if (error?.status === 413) {
      setFeedback({ severity: 'error', messageKey: 'kitchenTooLarge' });
    } else if (error?.status === 400 && /name/i.test(error.message)) {
      setNameError('kitchenNameLength');
    } else setFeedback(toFeedback(error));
  }

  async function onSave() {
    if (!canSave) return;
    const trimmed = name.trim();
    const content = parseOrReport();
    if (trimmed.length < 3 || trimmed.length > 80) {
      setNameError('kitchenNameLength');
      return;
    }
    setNameError(null);
    if (!content) return;
    setFeedback(null);
    const outcome = await submit(() =>
      mode === 'create'
        ? api.create({ name: trimmed, content })
        : api.update(initial.id, { name: trimmed, content, version }),
    );
    if (outcome.phase === 'ignored') return;
    if (outcome.phase !== 'succeeded') {
      handleSaveError(outcome.error);
      return;
    }
    const saved = outcome.result;
    setIssues([]);
    if (mode === 'edit') {
      loadRecord(saved);
      setConcurrency(NO_CONFLICT);
      setFeedback({
        severity: 'success',
        messageKey:
          saved.status === 'ACTIVE' ? 'kitchenSavedActive' : 'kitchenSaved',
        values: { version: saved.version },
      });
    }
    onSaved?.(saved);
  }

  async function onValidate() {
    const content = parseOrReport();
    if (!content) return;
    setFeedback(null);
    const outcome = await submit(() => api.validate(content));
    if (outcome.phase === 'ignored') return;
    if (outcome.phase !== 'succeeded') {
      setFeedback(toFeedback(outcome.error));
      return;
    }
    const found = outcome.result?.issues ?? [];
    setIssues(found);
    setFeedback(
      outcome.result?.valid
        ? { severity: 'success', messageKey: 'kitchenValidationOk' }
        : {
            severity: 'error',
            messageKey: 'kitchenValidationIssues',
            values: { count: found.length },
          },
    );
  }

  async function onImport(event) {
    const file = event.target.files?.[0];
    if (fileInput.current) fileInput.current.value = '';
    if (!file) return;
    try {
      const imported = await readImportFile(file);
      setText(imported.text);
      if (mode === 'create' && !name.trim()) setName(imported.suggestedName);
      setSyntaxError(null);
      setIssues([]);
      setFeedback({
        severity: 'info',
        messageKey: 'kitchenImported',
        values: { file: file.name },
      });
    } catch (error) {
      setFeedback({
        severity: 'error',
        messageKey: IMPORT_MESSAGES[error?.code] ?? 'kitchenImportRead',
      });
    }
  }

  async function onReloadLatest() {
    const outcome = await submit(() => api.getById(initial.id));
    if (outcome.phase === 'ignored') return;
    if (outcome.phase !== 'succeeded') {
      setFeedback(
        outcome.error?.status === 404
          ? { severity: 'error', messageKey: 'kitchenConfigurationGone' }
          : toFeedback(outcome.error),
      );
      return;
    }
    const latest = outcome.result;
    setConcurrency({
      ...NO_CONFLICT,
      phase: 'reviewing',
      latest,
      rebase: rebaseDraft(base, { name, text }, latest),
    });
  }

  function onResolveConflict(path, choice) {
    setConcurrency((current) => ({
      ...current,
      resolutions: { ...current.resolutions, [path]: choice },
    }));
  }

  function onContinueWithRebased() {
    if (rebase?.status !== 'ok' || rebase.unresolved > 0) return;
    const { latest } = concurrency;
    setName(rebase.candidate.name);
    setText(formatConfiguration(rebase.candidate.content));
    setVersion(latest.version);
    setStatus(latest.status);
    setBase({ name: latest.name, content: latest.content });
    setSyntaxError(null);
    setIssues([]);
    setConcurrency((current) => ({ ...current, continued: true }));
  }

  function onDiscardMyDraft() {
    if (!concurrency.latest) return;
    loadRecord(concurrency.latest);
    setSyntaxError(null);
    setIssues([]);
    setFeedback(null);
    setConcurrency(NO_CONFLICT);
  }

  function onAcknowledgeReview(checked) {
    setConcurrency((current) => ({ ...current, reviewAcknowledged: checked }));
  }

  return (
    <section className="kitchen-editor" aria-labelledby={`${prefix}-title`}>
      <h2 id={`${prefix}-title`}>
        {t(
          mode === 'create'
            ? 'kitchenEditorCreateTitle'
            : 'kitchenEditorEditTitle',
        )}
      </h2>
      {phase !== 'none' && (
        <ConcurrentChangePanel
          phase={phase}
          latest={concurrency.latest}
          rebase={rebase}
          resolutions={concurrency.resolutions}
          continued={continued}
          reviewAcknowledged={reviewAcknowledged}
          busy={isSubmitting}
          onReloadLatest={onReloadLatest}
          onResolveConflict={onResolveConflict}
          onContinueWithRebased={onContinueWithRebased}
          onDiscardMyDraft={onDiscardMyDraft}
          onAcknowledgeReview={onAcknowledgeReview}
        />
      )}
      <form
        noValidate
        aria-busy={isSubmitting || undefined}
        onSubmit={(event) => {
          event.preventDefault();
          void onSave();
        }}
      >
        <div className="form-field">
          <label htmlFor={`${prefix}-name`}>
            {t('kitchenConfigurationName')}{' '}
            <span className="required-field">({t('requiredField')})</span>
          </label>
          <input
            id={`${prefix}-name`}
            value={name}
            maxLength={80}
            readOnly={locked}onChange={(event) => {
              if (locked) return;
              setName(event.target.value);
              setNameError(null);
            }}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? `${prefix}-name-error` : undefined}
          />
          {nameError && (
            <p className="field-error" id={`${prefix}-name-error`}>
              {t(nameError)}
            </p>
          )}
        </div>
        <div className="form-field">
          <label htmlFor={`${prefix}-import`}>{t('kitchenImportFile')}</label>
          <input
            ref={fileInput}
            id={`${prefix}-import`}
            type="file"
            accept=".json,application/json"
            disabled={locked}
            onChange={onImport}
          />
        </div>
        <JsonContentEditor
          id={`${prefix}-json`}
          value={text}
          onChange={(value) => {
            if (locked) return;
            setText(value);
            setSyntaxError(null);
          }}
          syntaxError={syntaxError}
          readOnly={locked}
        />
        {feedback && <FeedbackMessage {...feedback} />}
        <ValidationIssueList issues={issues} id={`${prefix}-issues`} />
        <div className="form-actions">
          <button
            className="button button--secondary"
            type="button"
            disabled={isSubmitting || readOnly}
            onClick={() => void onValidate()}
          >
            {t('kitchenValidate')}
          </button>
          <button
            className="button button--primary"
            type="submit"
            disabled={!canSave}
          >
            {t('kitchenSave')}
          </button>
        </div>
        {mode === 'edit' && status === 'ACTIVE' && version !== null && (
          <p className="field-hint">
            {t('kitchenActiveConfiguration', {
              name: base?.name,
              id: initial.id,
            })}
          </p>
        )}
      </form>
    </section>
  );
}