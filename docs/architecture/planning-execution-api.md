# Planning execution API

Shared design for WEB07, AI01, AI02 and AI05. Procurement exposes these JSON routes through the Gateway. For each call, it verifies the current Manager session through Backoffice and checks access to the selected inputs or execution. Protected responses use `Cache-Control: no-store`. AI05 owns the public API and its OpenAPI registration. AI06 keeps the input and snapshot APIs private. [SAD §2.7](SAD.md#27-planning-access-and-records)

| Method and path | Purpose | Success |
| --- | --- | --- |
| `POST /api/v1/planning/executions` | Start a calculation, replay a completed run or retry an eligible attempt. | `202` while an attempt is active, with the result URL in `Location`. `200` with a completed result or saved failure. |
| `GET /api/v1/planning/executions/{executionId}/result` | Read the stored state and, when complete, the saved result. | `200` with the execution state. |
| `GET /api/v1/planning/executions` | List the Manager's authorised execution history. | `200` with `items` and `nextCursor` (null on the last page). Pass `cursor` to continue in newest-first order. |

## Start, retry and replay

WEB07 creates a UUID before submission. A forecast request fixes one immutable forecast version. Requirements Planning also requires a confirmed supplier scenario version. For a BOM-only forecast, send `BILL_OF_MATERIALS` and omit `supplierScenario`. AI01 can also take selected order demand. An order-based BOM caller sends `orderId` in place of the forecast fields once the order reader is connected.

```json
{
  "executionId": "29cbcffc-77b4-468d-96e0-cab643f53bfe",
  "planningType": "REQUIREMENTS_PLANNING",
  "forecastId": "FCST-00123",
  "forecastVersion": "3",
  "supplierScenario": { "id": "SCEN-00021", "version": "2" }
}
```

A replay sends only the new ID and the completed original's ID. Procurement checks access to the original, then uses its saved calculation type, inputs, eligibility and reference date. If those inputs are unavailable, return `422 HISTORICAL_INPUTS_UNAVAILABLE`. A new Requirements Planning run defaults to the execution date. An explicitly configured historical scenario may supply a different reference date through the server-side selection. A replay always takes its date from the original.

```json
{
  "executionId": "ae3bdeb4-213f-43c6-8f17-c55123cdc854",
  "replayedFrom": "29cbcffc-77b4-468d-96e0-cab643f53bfe"
}
```

An identical POST for an active or completed execution returns its state. A changed selection for the same ID returns `409 EXECUTION_SELECTION_CONFLICT`. A different execution ID for a forecast with an active attempt returns `409 FORECAST_EXECUTION_ACTIVE`. On an eligible manual retry, keep the execution ID and request, claim the next attempt and reuse the sealed snapshot if one exists. If a previous attempt has expired, it cannot save an outcome. [SAD claim and completion rules](SAD.md#27-planning-access-and-records)

## Status and history

The POST response and result read use the same state envelope. `request` is the original public POST body, available only to an authorised reader. It lets WEB07 retry after a reload. Poll only for `RUNNING` with `retryable: false`. An expired attempt is `RUNNING` with `retryable: true` on the result read. Stop polling and offer a manual retry, as for a retryable `FAILED` state. After a lost POST response, read the saved state first. An authorised `404 EXECUTION_NOT_FOUND` also permits retry if the original request is still available.

Example result read after an attempt expires:

```json
{
  "executionId": "29cbcffc-77b4-468d-96e0-cab643f53bfe",
  "status": "RUNNING",
  "retryable": true,
  "request": {
    "executionId": "29cbcffc-77b4-468d-96e0-cab643f53bfe",
    "planningType": "REQUIREMENTS_PLANNING",
    "forecastId": "FCST-00123",
    "forecastVersion": "3",
    "supplierScenario": { "id": "SCEN-00021", "version": "2" }
  }
}
```

A `COMPLETED` response sets `retryable: false` and includes `result`. The result contains `planningType`, `snapshotId`, `mode` (`current` or `historicalReplay`), `simulation`, source provenance and `data` specific to the calculation. It carries the forecast identity and version, stock snapshot and BOM references, plus the supplier version and reference date for a daily plan. A replay includes `replayedFrom`. The [AI01 result](../user_stories/ai/ai01/usAI01.md#423-result-and-ai02-handoff) supplies the BOM rows. The [AI02 example](../user_stories/ai/ai02/usAI02.md#34-rest-api-specification-arc03) supplies daily plan data, including warnings. A reviewable plan may contain unmet needs.

Example completed Requirements Planning result for an explicit zero-demand forecast:

```json
{
  "executionId": "29cbcffc-77b4-468d-96e0-cab643f53bfe",
  "status": "COMPLETED",
  "retryable": false,
  "result": {
    "planningType": "REQUIREMENTS_PLANNING",
    "snapshotId": "d0651efb-da36-453c-aa47-5e044e268d46",
    "forecast": { "id": "FCST-00123", "version": "3" },
    "stockSnapshotId": "d0651efb-da36-453c-aa47-5e044e268d46",
    "bomIds": [],
    "supplierScenario": { "id": "SCEN-00021", "version": "2" },
    "referenceDate": "2026-11-20",
    "mode": "current",
    "simulation": true,
    "provenance": [
      { "dataset": "demand", "source": "FCST-00123", "version": "3", "simulated": false },
      { "dataset": "catalogue", "source": "backoffice", "retrievedAt": "2026-11-20T10:00:00Z", "simulated": false },
      { "dataset": "stock", "source": "backoffice", "retrievedAt": "2026-11-20T10:00:00Z", "simulated": false },
      { "dataset": "receipts", "source": "backoffice", "retrievedAt": "2026-11-20T10:00:00Z", "simulated": false },
      { "dataset": "offers", "source": "SCEN-00021", "version": "2", "simulated": true }
    ],
    "data": { "referenceDate": "2026-11-20", "days": [], "proposals": [], "warnings": [] }
  }
}
```

The server may omit the original `request` from completed and non-retryable failed responses. For a retryable state it must return it.

History returns summaries. Open a summary's result URL to get the saved result or recover an eligible attempt.

```json
{
  "items": [{
    "executionId": "29cbcffc-77b4-468d-96e0-cab643f53bfe",
    "createdAt": "2026-11-20T10:00:00Z",
    "planningType": "REQUIREMENTS_PLANNING",
    "forecastId": "FCST-00123",
    "forecastVersion": "3",
    "status": "COMPLETED",
    "retryable": false,
    "mode": "current",
    "simulation": true
  }],
  "nextCursor": null
}
```

## Errors

A request rejected before acceptance uses the shared `error` envelope. Use `400` for malformed data, `401` for a missing or invalid session, `403` for insufficient access, `404` for an absent authorised record, `409` for conflicts, `422` for invalid or missing business inputs, and `503` if the service cannot accept or read the execution. A failure saved after acceptance is an execution state. A result read returns HTTP `200` with `status: "FAILED"`, `retryable`, the original `request` and a `diagnostic` with the same fields as `error` apart from HTTP status. Neither case returns a partial plan.

Example rejection for an inactive product before the first execution:

```json
{
  "error": {
    "status": 422,
    "code": "INACTIVE_PRODUCT",
    "message": "A product in the forecast is inactive.",
    "details": [{
      "path": "forecast.entries[0].productId",
      "code": "INACTIVE_PRODUCT",
      "message": "Select an active product.",
      "params": { "productId": "PROD-90030" }
    }]
  }
}
```
