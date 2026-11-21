import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useLocale } from '../locale/localeContext.js';
import { useFormValidation } from '../hooks/useFormValidation.js';
import { useSubmission } from '../hooks/useSubmission.js';
import { pendingOutcomes } from '../hooks/pendingOutcomes.js';
import RequireRole from '../../app/navigation/RequireRole.jsx';
import ConfirmationDialog from './ConfirmationDialog.jsx';
import EmptyState from './EmptyState.jsx';
import FeedbackMessage from './FeedbackMessage.jsx';
import LoadingState from './LoadingState.jsx';
import { toFeedback } from './errorMapper.js';
import { mergeDraft } from './mergeDraft.js';

const empty = (fields) =>
  Object.fromEntries(fields.map((field) => [field.name, field.initial ?? '']));
const isServerFailure = (error) =>
  error?.kind === 'http' && error.status >= 500;
const formatValue = (value) =>
  value !== null && typeof value === 'object'
    ? JSON.stringify(value)
    : String(value ?? '—');

function parseValues(fields, values) {
  const result = {};
  for (const field of fields) {
    const value = values[field.name];
    if (field.type === 'json')
      result[field.name] = value ? JSON.parse(value) : [];
    else if (field.type === 'multiselect') result[field.name] = value ?? [];
    else if (field.type === 'number')
      result[field.name] = value === '' ? null : Number(value);
    else if (field.type === 'boolean')
      result[field.name] = value === true || value === 'true';
    else result[field.name] = value === '' && field.nullable ? null : value;
  }
  return result;
}

/** WEB05 shared rendering only; feature data and HTTP contracts stay in each slice. */
export default function ManagementWorkspace({ config, api }) {
  const { t } = useLocale();
  const [records, setRecords] = useState([]);
  const [viewState, setViewState] = useState('loading');
  const [filters, setFilters] = useState(config.initialFilters ?? {});
  const [draftFilters, setDraftFilters] = useState(config.initialFilters ?? {});
  const [form, setForm] = useState(() => empty(config.fields));
  const [baseForm, setBaseForm] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [staleConflict, setStaleConflict] = useState(null);
  const [conflictChoices, setConflictChoices] = useState({});
  const [action, setAction] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [, setPendingVersion] = useState(0);
  const { validate, clearErrors, fieldProps, errors } = useFormValidation();
  // Repeatable by default; non-repeatable operations are blocked through
  // pendingOutcomes below, so the block survives navigation (BR25).
  const { isSubmitting, submit } = useSubmission();
  const initialRouteHandled = useRef(false);
  const recordId = (item) =>
    config.getId ? config.getId(item) : item[config.idKey];
  const toFormValues = (record) =>
    config.toForm
      ? config.toForm(record)
      : { ...empty(config.fields), ...record };
  const mergeFieldNames = config.fields
    .map((field) => field.name)
    .filter((name) => name !== config.versionField);

  // Creating a record and row actions marked nonRepeatable (e.g. stock
  // adjustment) must not be sent again while their result is unknown.
  const pendingScope = `${config.titleKey}:`;
  const createKey = `${pendingScope}create`;
  const actionKey = (item, definition) =>
    `${pendingScope}${definition.key}:${recordId(item)}`;
  const pendingList = pendingOutcomes.list(pendingScope);
  const createPending = pendingOutcomes.has(createKey);

  const markPending = (key, details) => {
    pendingOutcomes.add(key, details);
    setPendingVersion((version) => version + 1);
  };

  // Some pages build config on every render: read it through a ref so load()
  // keeps the same identity and does not trigger a new request each render.
  const configRef = useRef(config);
  configRef.current = config;

  const load = useCallback(
    async (query = filters, signal) => {
      const { getId, idKey } = configRef.current;
      const idOf = (item) => (getId ? getId(item) : item[idKey]);
      setViewState('loading');
      try {
        const result = await api.list(query, signal);
        const rows = Array.isArray(result) ? result : (result?.items ?? []);
        setRecords(rows);
        // The open detail must show the reloaded record, not the old one.
        setSelected((old) =>
          old ? (rows.find((row) => idOf(row) === idOf(old)) ?? null) : null,
        );
        setViewState(rows.length ? 'ready' : 'empty');
        return rows;
      } catch (error) {
        if (signal?.aborted || error?.kind === 'aborted') return;
        setViewState('error');
        setFeedback(toFeedback(error, 'managementLoadError'));
        return false;
      }
    },
    [api, filters],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(filters, controller.signal);
    return () => controller.abort();
  }, [filters, load]);

      // BR25: the block is released only after the API has been consulted.
  const confirmPending = async (key) => {
    const entry = pendingOutcomes
      .list(pendingScope)
      .find((item) => item.key === key);
    if (!entry) return;
    setFeedback(null);
    const rows = await load();
    if (!rows) return; // API not reachable: the operation stays blocked
    const definition =
      entry.kind === 'action'
        ? config.rowActions?.find((item) => item.key === entry.actionKey)
        : null;
    const verify =
      entry.kind === 'action' ? definition?.verifyOutcome : config.verifyCreate;
    let outcome = 'reviewed';
    if (verify) {
      try {
        outcome = await verify(api, entry);
      } catch {
        outcome = 'unconfirmed';
      }
    }
    if (outcome === 'unconfirmed') {
      setFeedback({ severity: 'warning', messageKey: 'pendingOutcomeUnconfirmed' });
      return;
    }
    pendingOutcomes.remove(key);
    setPendingVersion((version) => version + 1);
    if (outcome === 'applied') {
      setAction(null);
      setFormOpen(false);
      setFeedback({ severity: 'success', messageKey: 'pendingOutcomeApplied' });
      return;
    }
    // Not applied (or nothing to compare with): give the values back.
    setFeedback({
      severity: 'warning',
      messageKey:
        outcome === 'notApplied' ? 'pendingOutcomeNotApplied' : 'pendingOutcomeReviewed',
    });
    restoreValues(entry, definition, rows);
  };

  function restoreValues(entry, definition, rows) {
    if (!entry.values) return;
    if (entry.kind === 'action') {
      const item = rows.find((row) => recordId(row) === entry.recordId);
      if (!definition || !item) return;
      setFormOpen(false);
      setForm({ ...empty(definition.fields), ...entry.values });
      setAction({ item, definition });
      return;
    }
    setEditing(null);
    setBaseForm(null);
    setAction(null);
    setForm({ ...empty(config.fields), ...entry.values });
    setFormOpen(true);
  }

  const beginCreate = () => {
    setStaleConflict(null);
    setConflictChoices({});
    setEditing(null);
    setBaseForm(null);
    setForm(empty(config.fields));
    setAction(null);
    setFormOpen(true);
    setFeedback(
      pendingOutcomes.has(createKey)
        ? { severity: 'warning', messageKey: 'pendingOutcomeNotice' }
        : null,
    );
  };

  const beginEdit = async (record) => {
    setStaleConflict(null);
    setConflictChoices({});
    setFeedback(null);
    try {
      const value = api.getById ? await api.getById(recordId(record)) : record;
      const values = toFormValues(value);
      setEditing(value);
      setBaseForm(values);
      setForm(values);
      setAction(null);
      setFormOpen(true);
    } catch (error) {
      setFeedback(toFeedback(error));
    }
  };

  useEffect(() => {
    if (initialRouteHandled.current) return;
    initialRouteHandled.current = true;
    if (config.initialAction === 'create') beginCreate();
    if (config.initialAction === 'edit' && config.initialRecordId)
      void beginEdit({ [config.idKey]: config.initialRecordId });
  }, []);

  async function save(event) {
    event.preventDefault();
    if (staleConflict) return;
    if (!editing && pendingOutcomes.has(createKey)) {
      setFeedback({ severity: 'warning', messageKey: 'pendingOutcomeNotice' });
      return;
    }
    if (!validate(event.currentTarget)) return;
    let payload;
    try {
      payload = config.toPayload
        ? config.toPayload(form, Boolean(editing), baseForm)
        : parseValues(config.fields, form);
    } catch {
      setFeedback({ severity: 'error', messageKey: 'managementInvalidJson' });
      return;
    }
    const validationMessage = config.validatePayload?.(payload);
    if (validationMessage) {
      setFeedback({ severity: 'error', messageKey: validationMessage });
      return;
    }
    setFeedback(null);
    const result = await submit(
      () =>
        editing
          ? api.update(recordId(editing), payload)
          : api.create(payload),
      { isOutcomeUnknown: (error) => !editing && isServerFailure(error) },
    );
    if (result.phase === 'succeeded') {
      setFeedback({
        severity: 'success',
        messageKey: editing ? 'managementSaved' : 'managementCreated',
      });
      setForm(empty(config.fields));
      setBaseForm(null);
      setEditing(null);
      setFormOpen(false);
      setSelected(null);
      await load();
    } else if (result.phase === 'outcome_unknown') {
      // Edits are guarded by the version field (a repeated update gets 412);
      // a repeated create would duplicate the record, so it is blocked.
      if (!editing)
        markPending(createKey, {
          kind: 'create',
          labelKey: config.createLabelKey ?? 'managementCreate',
          // Only operations verified against the API keep their values (BR 13).
          values: config.verifyCreate ? form : undefined,
        });
      setFeedback({ severity: 'warning', messageKey: 'mutationOutcomeUnknown' });
    } else if (
      result.error?.status === 412 &&
      editing &&
      api.getById &&
      config.versionField
    ) {
      setFeedback(toFeedback(result.error));
      await reloadCurrentForReview();
    } else if (result.error) setFeedback(toFeedback(result.error));
  }

  async function reloadCurrentForReview() {
    if (!editing || !api.getById) return;
    setStaleConflict({ status: 'loading' });
    setConflictChoices({});
    try {
      const current = await api.getById(recordId(editing));
      setStaleConflict({ status: 'ready', record: current });
    } catch (error) {
      setStaleConflict({ status: 'error', error });
    }
  }

  // Draft changes are re-applied on top of the current record; fields that
  // both managers changed need an explicit choice (clarification 15).
  const review =
    staleConflict?.status === 'ready'
      ? (() => {
          const current = toFormValues(staleConflict.record);
          return {
            current,
            ...mergeDraft({
              base: baseForm ?? current,
              draft: form,
              current,
              fieldNames: mergeFieldNames,
            }),
          };
        })()
      : null;
  const unresolvedConflicts =
    review?.conflicts.filter((name) => !conflictChoices[name]) ?? [];

  function acknowledgeCurrentVersion() {
    if (!review || !config.versionField || unresolvedConflicts.length) return;
    const next = { ...review.merged };
    for (const name of review.conflicts)
      next[name] =
        conflictChoices[name] === 'current' ? review.current[name] : form[name];
    next[config.versionField] = staleConflict.record.updatedAt;
    setForm(next);
    setBaseForm(review.current);
    setEditing(staleConflict.record);
    setStaleConflict(null);
    setConflictChoices({});
    setFeedback({ severity: 'success', messageKey: 'currentDataReviewed' });
  }

  async function runAction(item, selectedAction, values = {}) {
    const key = actionKey(item, selectedAction);
    if (selectedAction.nonRepeatable && pendingOutcomes.has(key)) {
      setFeedback({ severity: 'warning', messageKey: 'pendingOutcomeNotice' });
      return;
    }
    setFeedback(null);
    let payload;
    try {
      payload = selectedAction.fields?.length
        ? selectedAction.toPayload
          ? selectedAction.toPayload(values)
          : parseValues(selectedAction.fields, values)
        : {};
    } catch {
      setFeedback({ severity: 'error', messageKey: 'managementInvalidJson' });
      return;
    }
    const result = await submit(
      () => selectedAction.run(api, item, payload),
      {
        isOutcomeUnknown: (error) =>
          Boolean(selectedAction.nonRepeatable) && isServerFailure(error),
      },
    );
    if (result.phase === 'succeeded') {
      setFeedback({
        severity: 'success',
        messageKey: selectedAction.successKey ?? 'managementChanged',
      });
      setAction(null);
      setConfirmation(null);
      setSelected(null);
      await load();
        } else if (result.phase === 'outcome_unknown') {
      if (selectedAction.nonRepeatable)
        markPending(key, {
          kind: 'action',
          actionKey: selectedAction.key,
          labelKey: selectedAction.labelKey,
          recordId: recordId(item),
          // Only operations verified against the API keep their values (BR 13).
          values: selectedAction.verifyOutcome ? values : undefined,
          before: selectedAction.snapshot?.(item),
          summary: selectedAction.describe?.(values),
        });
      setFeedback({ severity: 'warning', messageKey: 'mutationOutcomeUnknown' });
    } else if (result.error) setFeedback(toFeedback(result.error));
  }

  function renderField(field, value, onChange) {
    const label = t(field.labelKey);
    const common = {
      ...fieldProps(field.name),
      name: field.name,
      required: field.required,
      value: field.type === 'boolean' ? undefined : (value ?? ''),
      onChange: (event) => {
        clearErrors(event);
        onChange(
          field.type === 'boolean' ? event.target.checked : event.target.value,
        );
      },
    };
    return (
      <div className="form-field" key={field.name}>
        {field.type === 'composition' ? (
          <fieldset className="management-composition">
            <legend>{label}</legend>
            {field.helpKey && <p>{t(field.helpKey)}</p>}
            {(Array.isArray(value) ? value : []).map((item, index) => {
              const productInputId = `${field.name}-${index}-product`;
              const quantityInputId = `${field.name}-${index}-quantity`;
              return (
              <div className="management-composition__row" key={`${index}-${item.productId}`}>
                <label htmlFor={productInputId}>{t('name')}</label>
                <select
                  id={productInputId}
                  name={`${field.name}-product-${index}`}
                  required
                  aria-invalid={errors[productInputId] ? true : undefined}
                  value={item.productId ?? ''}
                  onChange={(event) => {
                    clearErrors(event);
                    onChange(
                      value.map((current, currentIndex) =>
                        currentIndex === index
                          ? { ...current, productId: event.target.value }
                          : current,
                      ),
                    );
                  }}
                >
                  <option value="">—</option>
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <label htmlFor={quantityInputId}>{t('units')}</label>
                <input
                  id={quantityInputId}
                  name={`${field.name}-quantity-${index}`}
                  type="number"
                  min="1"
                  step="1"
                  required
                  aria-invalid={errors[quantityInputId] ? true : undefined}
                  value={item.quantity ?? 1}
                  onChange={(event) => {
                    clearErrors(event);
                    onChange(
                      value.map((current, currentIndex) =>
                        currentIndex === index
                          ? { ...current, quantity: event.target.value }
                          : current,
                      ),
                    );
                  }}
                />
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={() => onChange(value.filter((_, row) => row !== index))}
                >
                  {t(field.removeLabelKey)}
                </button>
              </div>
              );
            })}
            {!field.options.length && field.emptyOptionsKey && (
              <p>{t(field.emptyOptionsKey)}</p>
            )}
            <div className="form-actions">
              <button
                className="button button--secondary"
                type="button"
                disabled={!field.options.length}
                onClick={() => onChange([...(value ?? []), { productId: '', quantity: 1 }])}
              >
                {t(field.addLabelKey)}
              </button>
              {field.onRefreshOptions && (
                <button
                  className="button button--secondary"
                  type="button"
                  disabled={field.optionsLoading}
                  onClick={() => void field.onRefreshOptions()}
                >
                  {t(field.refreshLabelKey)}
                </button>
              )}
            </div>
          </fieldset>
        ) : field.type === 'checkboxGroup' ? (
          <fieldset
            className="management-checkbox-group"
            aria-describedby={field.helpKey ? `${field.name}-help` : undefined}
          >
            <legend>{label}</legend>
            {field.helpKey && (
              <p id={`${field.name}-help`}>{t(field.helpKey)}</p>
            )}
            <div className="management-checkbox-group__options">
              {field.options.map((option) => (
                <label key={option.value}>
                  <input
                    type="checkbox"
                    name={field.name}
                    value={option.value}
                    checked={Array.isArray(value) && value.includes(option.value)}
                    onChange={(event) => {
                      const selected = new Set(value ?? []);
                      if (event.target.checked) selected.add(option.value);
                      else selected.delete(option.value);
                      onChange([...selected]);
                    }}
                  />
                  <span>{option.label ?? t(option.labelKey)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <>
            {field.type !== 'boolean' && (
              <label htmlFor={field.name}>{label}</label>
            )}
            {field.type === 'select' || field.type === 'multiselect' ? (
              <select
                {...common}
                multiple={field.type === 'multiselect'}
                onChange={(event) => {
                  clearErrors(event);
                  onChange(
                    field.type === 'multiselect'
                      ? [...event.target.selectedOptions].map(
                          (option) => option.value,
                        )
                      : event.target.value,
                  );
                }}
              >
                {field.type !== 'multiselect' && <option value="">—</option>}
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label ?? t(option.labelKey)}
                  </option>
                ))}
              </select>
            ) : field.type === 'boolean' ? (
              <label className="management-boolean-field" htmlFor={field.name}>
                <input
                  {...fieldProps(field.name)}
                  id={field.name}
                  name={field.name}
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(event) => {
                    clearErrors(event);
                    onChange(event.target.checked);
                  }}
                />
                <span>{label}</span>
              </label>
            ) : field.type === 'json' ? (
              <textarea {...common} id={field.name} rows={4} spellCheck="false" />
            ) : (
              <input
                {...common}
                id={field.name}
                type={
                  field.type === 'number'
                    ? 'number'
                    : field.type === 'email'
                      ? 'email'
                      : 'text'
                }
                step={field.step}
                min={field.min}
                max={field.max}
              />
            )}
          </>
        )}
        {errors[field.name] && (
          <small id={`${field.name}-error`}>
            {t(errors[field.name].key, errors[field.name])}
          </small>
        )}
      </div>
    );
  }

  return (
    <section
      className="business-management"
      aria-labelledby={`${config.titleKey}-title`}
    >
      <h1 id={`${config.titleKey}-title`}>{t(config.titleKey)}</h1>
      {config.introKey && <p className="intro">{t(config.introKey)}</p>}
      {config.filterFields?.length > 0 && (
        <form
          className="catalogue-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            setFeedback(null);
            setFilters(
              Object.fromEntries(
                Object.entries(draftFilters).filter(
                  ([, value]) =>
                    value !== '' && !(Array.isArray(value) && value.length === 0),
                ),
              ),
            );
          }}
        >
          <div className="catalogue-search__row">
            {config.filterFields.map((field) =>
              field.type === 'checkboxGroup' ? (
                <fieldset
                  className="catalogue-search__checkbox-group"
                  key={field.name}
                >
                  <legend>{t(field.labelKey)}</legend>
                  <div className="catalogue-search__checkbox-options">
                    {field.options.map((option) => (
                      <label key={option.value}>
                        <input
                          type="checkbox"
                          name={field.name}
                          value={option.value}
                          checked={(
                            draftFilters[field.name] ?? []
                          ).includes(option.value)}
                          onChange={(event) =>
                            setDraftFilters((old) => {
                              const selected = new Set(old[field.name] ?? []);
                              if (event.target.checked)
                                selected.add(option.value);
                              else selected.delete(option.value);
                              return { ...old, [field.name]: [...selected] };
                            })
                          }
                        />
                        <span>{option.label ?? t(option.labelKey)}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : (
                <label key={field.name}>
                  {t(field.labelKey)}
                  {field.type === 'select' || field.type === 'multiselect' ? (
                    <select
                      multiple={field.type === 'multiselect'}
                      value={
                        draftFilters[field.name] ??
                        (field.type === 'multiselect' ? [] : '')
                      }
                      onChange={(event) =>
                        setDraftFilters((old) => ({
                          ...old,
                          [field.name]:
                            field.type === 'multiselect'
                              ? [...event.target.selectedOptions].map(
                                  (option) => option.value,
                                )
                              : event.target.value,
                        }))
                      }
                    >
                      {field.type !== 'multiselect' && (
                        <option value="">—</option>
                      )}
                      {field.options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label ?? t(option.labelKey)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="search"
                      value={draftFilters[field.name] ?? ''}
                      onChange={(event) =>
                        setDraftFilters((old) => ({
                          ...old,
                          [field.name]: event.target.value,
                        }))
                      }
                    />
                  )}
                </label>
              ),
            )}
            <button className="button button--primary" type="submit">
              {t('managementSearch')}
            </button>
          </div>
        </form>
      )}
      {feedback && <FeedbackMessage {...feedback} />}
      {pendingList.length > 0 && (
        <section className="management-details" aria-live="polite">
          <FeedbackMessage severity="warning" messageKey="pendingOutcomeNotice" />
          <ul>
              {pendingList.map((entry) => (
              <li key={entry.key}>
                {t(entry.labelKey ?? 'managementChanged')}
                {entry.recordId ? `: ${entry.recordId}` : ''}
                {entry.summary ? ` (${entry.summary})` : ''}{' '}
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={() => void confirmPending(entry.key)}
                >
                  {t('pendingOutcomeConfirm')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="form-actions">
        <button
          className="button button--secondary"
          type="button"
          onClick={() => {
            setFeedback(null);
            void load();
          }}
        >
          {t('managementRefresh')}
        </button>
        {config.canCreate && (
          <RequireRole roles={['MANAGER']}>
            <button
              className="button button--primary"
              type="button"
              onClick={beginCreate}
            >
              {t(config.createLabelKey ?? 'managementCreate')}
            </button>
          </RequireRole>
        )}
      </div>
      {viewState === 'loading' && <LoadingState />}
      {viewState === 'error' && (
        <button
          className="button button--secondary"
          type="button"
          onClick={() => void load()}
        >
          {t('retry')}
        </button>
      )}
      {viewState === 'empty' && <EmptyState titleKey="managementNoResults" />}
      {records.length > 0 && viewState !== 'error' && (
        <div className="table-scroll">
          <table className="kitchen-table">
            <thead>
              <tr>
                {config.columns.map((column) => (
                  <th scope="col" key={column.key}>
                    {t(column.labelKey)}
                  </th>
                ))}
                <th scope="col">{t('managementActions')}</th>
              </tr>
            </thead>
            <tbody>
              {records.map((item) => (
                <tr key={recordId(item)}>
                  {config.columns.map((column) => (
                    <td key={column.key}>
                      {column.render
                        ? column.render(item, records, t)
                        : String(item[column.key] ?? '—')}
                    </td>
                  ))}
                  <td>
                    <div className="form-actions">
                      <button
                        className="button button--secondary"
                        type="button"
                        onClick={() => setSelected(item)}
                      >
                        {t('managementDetails')}
                      </button>
                      {config.canEdit && (
                        <RequireRole roles={['MANAGER']}>
                          <button
                            className="button button--secondary"
                            type="button"
                            onClick={() => void beginEdit(item)}
                          >
                            {t('managementEdit')}
                          </button>
                        </RequireRole>
                      )}
                      {config.rowActions
                        ?.filter(
                          (rowAction) =>
                            !rowAction.show || rowAction.show(item),
                        )
                        .map((rowAction) => (
                          <RequireRole key={rowAction.key} roles={['MANAGER']}>
                            {rowAction.to ? (
                              <Link
                                className="button button--secondary"
                                to={rowAction.to(item)}
                              >
                                {t(rowAction.labelKey)}
                              </Link>
                            ) : (
                              <button
                                className={`button ${rowAction.danger ? 'button--danger' : 'button--secondary'}`}
                                type="button"
                                onClick={() => {
                                  setFormOpen(false);
                                  if (rowAction.fields?.length) {
                                    setAction({ item, definition: rowAction });
                                    setForm(empty(rowAction.fields));
                                  } else
                                    setConfirmation({
                                      item,
                                      definition: rowAction,
                                    });
                                }}
                              >
                                {t(rowAction.labelKey)}
                              </button>
                            )}
                          </RequireRole>
                        ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selected && (
        <section className="management-details">
          <h2>
            {t('managementDetails')}: {selected[config.idKey]}
          </h2>
          <dl>
            {(config.detailFields ?? config.columns).map((field) => (
              <div key={field.key}>
                <dt>{t(field.labelKey)}</dt>
                <dd>
                  {field.render
                    ? field.render(selected, records, t)
                    : typeof selected[field.key] === 'object'
                      ? JSON.stringify(selected[field.key])
                      : String(selected[field.key] ?? '—')}
                </dd>
              </div>
            ))}
          </dl>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => setSelected(null)}
          >
            {t('managementCancel')}
          </button>
        </section>
      )}
      {formOpen && (
        <RequireRole roles={['MANAGER']}>
          <form className="management-form" onSubmit={save} noValidate>
            <h2>
              {t(editing ? 'managementEditTitle' : 'managementCreateTitle')}
            </h2>
            {config.fields.map((field) =>
              renderField(field, form[field.name], (value) =>
                setForm((old) => ({ ...old, [field.name]: value })),
              ),
            )}
            {staleConflict && (
              <section className="management-details" aria-live="polite">
                <h3>{t('currentProductData')}</h3>
                {staleConflict.status === 'loading' && <LoadingState />}
                {staleConflict.status === 'error' && (
                  <>
                    <FeedbackMessage
                      severity="error"
                      messageKey="managementLoadError"
                    />
                    <button
                      className="button button--secondary"
                      type="button"
                      onClick={() => void reloadCurrentForReview()}
                    >
                      {t('retry')}
                    </button>
                  </>
                )}
                {staleConflict.status === 'ready' && (
                  <>
                    <dl>
                      {(config.detailFields ?? config.columns).map((field) => (
                        <div key={field.key}>
                          <dt>{t(field.labelKey)}</dt>
                          <dd>
                            {field.render
                              ? field.render(staleConflict.record, records, t)
                              : typeof staleConflict.record[field.key] === 'object'
                                ? JSON.stringify(staleConflict.record[field.key])
                                : String(staleConflict.record[field.key] ?? '—')}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    {review.conflicts.length > 0 && (
                      <fieldset className="management-conflicts">
                        <legend>{t('conflictingFields')}</legend>
                        {review.conflicts.map((name) => {
                          const field = config.fields.find(
                            (item) => item.name === name,
                          );
                          return (
                            <div className="form-field" key={name}>
                              <strong>{t(field?.labelKey ?? name)}</strong>
                              <label>
                                <input
                                  type="radio"
                                  name={`conflict-${name}`}
                                  checked={conflictChoices[name] === 'mine'}
                                  onChange={() =>
                                    setConflictChoices((old) => ({
                                      ...old,
                                      [name]: 'mine',
                                    }))
                                  }
                                />
                                <span>
                                  {t('keepMyValue')}: {formatValue(form[name])}
                                </span>
                              </label>
                              <label>
                                <input
                                  type="radio"
                                  name={`conflict-${name}`}
                                  checked={conflictChoices[name] === 'current'}
                                  onChange={() =>
                                    setConflictChoices((old) => ({
                                      ...old,
                                      [name]: 'current',
                                    }))
                                  }
                                />
                                <span>
                                  {t('useCurrentValue')}:{' '}
                                  {formatValue(review.current[name])}
                                </span>
                              </label>
                            </div>
                          );
                        })}
                        {unresolvedConflicts.length > 0 && (
                          <p>{t('resolveConflictsFirst')}</p>
                        )}
                      </fieldset>
                    )}
                    <button
                      className="button button--secondary"
                      type="button"
                      disabled={unresolvedConflicts.length > 0}
                      onClick={acknowledgeCurrentVersion}
                    >
                      {t('reviewAndContinue')}
                    </button>
                  </>
                )}
              </section>
            )}
            <div className="form-actions">
              <button
                className="button button--primary"
                type="submit"
                disabled={
                  isSubmitting ||
                  (!editing && createPending) ||
                  Boolean(staleConflict)
                }
              >
                {t('managementSave')}
              </button>
              <button
                className="button button--secondary"
                type="button"
                onClick={() => {
                  setFormOpen(false);
                  setEditing(null);
                  setBaseForm(null);
                  setStaleConflict(null);
                  setConflictChoices({});
                }}
              >
                {t('managementCancel')}
              </button>
            </div>
          </form>
        </RequireRole>
      )}
      {action && (
        <RequireRole roles={['MANAGER']}>
          <form
            className="management-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (validate(event.currentTarget))
                void runAction(action.item, action.definition, form);
            }}
            noValidate
          >
            <h2>{t(action.definition.labelKey)}</h2>
            {action.definition.fields.map((field) =>
              renderField(field, form[field.name], (value) =>
                setForm((old) => ({ ...old, [field.name]: value })),
              ),
            )}
            <button
              className="button button--primary"
              type="submit"
              disabled={
                isSubmitting ||
                (Boolean(action.definition.nonRepeatable) &&
                  pendingOutcomes.has(actionKey(action.item, action.definition)))
              }
            >
              {t('managementSave')}
            </button>
            <button
              className="button button--secondary"
              type="button"
              onClick={() => setAction(null)}
            >
              {t('managementCancel')}
            </button>
          </form>
        </RequireRole>
      )}
      <ConfirmationDialog
        open={Boolean(confirmation)}
        consequenceKey={
          confirmation?.definition.confirmKey ?? 'managementConfirmStatus'
        }
        confirmLabelKey="confirm"
        onCancel={() => setConfirmation(null)}
        onConfirm={() =>
          void runAction(confirmation.item, confirmation.definition)
        }
      />
    </section>
  );
}
