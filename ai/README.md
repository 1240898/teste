# Procurement planning (IARTI)

AI01 implements pizza material requirements in SWI-Prolog. It consumes the
`planning_input` contract agreed with AI06 and returns `ok(Lines)` or
`error(Diagnostic)`. The local demonstration uses versioned input mocks.

## Run

Install SWI-Prolog 9.2 or later and make `swipl` available on the command line.
Node.js is also needed for the JSON boundary tests.
Run these commands from the repository root.

```sh
swipl -q -s ai/tests/bom_tests.pl -g run_tests -t halt
node ai/tests/json_boundary_tests.mjs
swipl -q -s ai/demo_bom.pl -g "demo(worked)" -t halt
swipl -q -s ai/demo_bom.pl -g "demo(iarti)" -t halt
swipl -q -s ai/demo_bom.pl -g "demo(iarti_balanced)" -t halt
swipl -q -s ai/demo_bom.pl -g "demo(ordered_ham_cheese)" -t halt
swipl -q -s ai/demo_bom.pl -g "demo_stock(briefcase)" -t halt
```

The demo prints JSON with the scenario metadata, simulation flag and requirement
rows. Each invocation constructs a fresh input. To call the calculation directly
from a Prolog consumer, load `ai/src/bom.pl` and call
`bom_requirements(Input, Outcome)`.

`demo_stock/1` prints the teacher's withdrawal and order lists (LWS/LOS).
From a successful `ok(Lines)`, call `stock_lists(Lines, Withdraw, Order)` to obtain
`(Quantity, ProductId)` pairs, omitting zero quantities and preserving row order.
The order list reports material shortages. AI02 plans suppliers and dates.

## Input and result

`Input` is a ground dict with tag `planning_input`. AI01 consumes `meta`,
`eligibility`, `pizza_demand`, `pizza_boms`, `items`, `recipes` and `opening_stock`.
The additional AI02 fields can travel in the same dict. Business identifiers are
case-sensitive strings. Enumerated kinds and acquisition types are atoms.

| Key | Representation |
| --- | --- |
| `meta` | Execution metadata with string `scenarioId` and `mode`. Mode must be `"current"` or `"historicalReplay"`. Retained by the caller for result association. |
| `eligibility` | Dict with `products` and `sizes` lists of `product_active(Id, Boolean)` and `size_active(Id, Boolean)`. Historical replay supplies the original eligibility. |
| `pizza_demand` | `pizza_demand(Date, BomId, Quantity)` terms. Date is `none` or a calendar `date(Year, Month, Day)`. AI01 totals the rows supplied by its caller. |
| `pizza_boms` | `bom(BomId, PizzaId, SizeId, Components)` terms with `component(ProductId, UnitsPerPizza)`. A personalised BOM can use `none` for its catalogue pizza ID. |
| `items` | `item(ProductId, Kind, Tracked, Acquisition, StockUnit, UnitsPerSale)` terms. Aggregate acquisition is `produced` or `purchased`. Optional values use `none`. |
| `recipes` | `recipe(ProductId, Yield, Ingredients)` terms with positive `ingredient(ProductId, UnitsPerBatch)` quantities. |
| `opening_stock` | `stock(ProductId, AvailableUnits)` terms, including explicit zero for tracked items. |

Quantities are exact integers in each product's own stock unit. An ordinary
untracked component has `none` consumption and no opening balance. Produced
preparations and their quantified ingredients require stock tracking. A tracked
component can consume zero units. Missing consumption, balance or classification
returns a diagnostic.

The calculation validates reachable recipes before using stock, then processes
parents before ingredients. It combines all contributions to an item before
netting stock or rounding batches. Produced residuals use whole batches, with
`batchCount = (residual + yield - 1) // yield`. Purchased aggregates and terminal
items report their residual as replenishment. They keep their descriptive
children outside the demand graph.

The three steps to explain in the IARTI defence are:

1. `visit_item` follows components and recipes in depth. The active path detects
   cycles; the completed-item index recognises shared ingredients. The traversal
   builds an order in which parents precede their ingredients.
2. `net_items` follows that order, so all parents contribute before an ingredient
   uses its stock. It calculates withdrawn units and the remaining demand once
   per item.
3. `plan_item` rounds an internal preparation's remaining demand up to whole
   batches and adds the ingredients for those batches. A terminal or purchased
   item instead contributes its remaining demand to replenishment.

Each result row has `productId`, `requiredUnits`, `availableUnits`,
`withdrawnUnits`, `residualUnits`, `batchCount`, `plannedProductionUnits`,
`surplusUnits`, `remainingUnits` and `replenishmentUnits`. Rows are sorted by
product ID. A shortage is a successful calculation. Closing balances assume the
displayed production can obtain its material deficits.

Diagnostics identify the code, field and affected reference. They also carry the
scenario and execution IDs when available. A cycle includes its closed path.

`src/json_boundary.pl` exports `write_planning_json/2`. It checks every integer,
including nested metadata,
before writing JSON. JSON numbers must be in JavaScript's safe integer range
`[-9007199254740991, 9007199254740991]`. A value outside that range returns
an `error` object with code `JSON_INTEGER_OUT_OF_RANGE`, its field path and the
exact decimal value as a diagnostic string. Non-empty string `scenarioId` and
`executionId` values are retained in both the response and its diagnostic;
malformed references are omitted. No partial result is written and
quantities are never silently rounded or changed to strings. Prolog arithmetic
still accepts larger integers. The demo imports this module. AI05 can import
`json_boundary` directly without depending on the demo, and must reject unsafe
numeric inputs at its web boundary when integrated.

The Node.js tests exercise Prolog serialisation, `JSON.parse` and `JSON.stringify`,
including both safe limits and the reported `9007199254740993` case. With a
portable SWI-Prolog installation, pass its executable as the script's argument:
`node ai/tests/json_boundary_tests.mjs <path-to-swipl.exe>`.

A BOM size of `none` returns `MISSING_FIELD` at `pizza_boms.sizeId`, referencing
the affected BOM. A supplied invalid size returns `INVALID_REFERENCE`, and an
unknown string ID returns `UNKNOWN_SIZE`. `INVALID_MODE` references the received
mode value and keeps the scenario and execution IDs as separate context.

## Continuous integration

`.github/workflows/ai-checks.yml` runs the Prolog and Node.js suites in a
`swipl:9.2.9` container, using the Node.js version in `frontend/.nvmrc`.
It can be started manually or called by another workflow. The existing
scheduled CI calls the same workflow. Deployment also calls it with the selected
release SHA, and packaging requires its success. A failed AI suite prevents that
release from proceeding to deployment. The rollback workflow retains its own
recovery path.

## Demonstration inputs

`fixtures/bom_fixtures.pl` mocks the AI06 input boundary. `iarti` and
`iarti_balanced` have version `2`; the other fixtures have version `1`. All have
fixed UUID execution references and `simulation:true`. These UUIDs are mock
references for repeatable demonstrations; AI05 will allocate real execution IDs.
`demo_bom.pl` adds the metadata to
the calculation output for local inspection. AI05 will own HTTP access,
authorisation and execution storage when it is connected.

| Fixture | Purpose |
| --- | --- |
| `worked` | S03, with chained dough and premix recipes. Shortages are 4 cheese, 1 water and 2 flour. Premix closes with 1 unit. |
| `sufficient_stock` | S01, with enough base, cheese and tomato. No preparation ingredients are demanded. |
| `shortage` | S02, with insufficient cheese and zero tomato stock. |
| `shared_ingredient` | S05, with two preparations and a direct component sharing premix before batch rounding. |
| `personalized` | S14, with two compositions sharing the catalogue pizza and size. |
| `ordered_ham_cheese` | S13, with 5 medium pizzas consuming 2 mozzarella units and 1 ham unit each. Stocks of 6 and 5 leave 4 mozzarella units missing. |
| `cheese_example` | The AI06 contract example, requiring 600 g with 400 g available and 200 g missing. |
| `briefcase` | The teacher's request for 60 briefcases, represented as a training BOM. Stock covers 10 finished assemblies. The remaining raw-material shortages are 15 locks and 5 handles. |
| `iarti` | Three sizes, two internally produced doughs, twenty terminal ingredients, a purchased pesto aggregate and eight pizza types, giving 24 size-specific BOMs. Pesto requires 280 g; its 100 g stock leaves 180 g to replenish. |
| `iarti_balanced` | The same large dataset with more stock: covered ingredients, partially covered mozzarella, ham and pesto, and zero basil. Shortages are 1,420 g mozzarella, 380 g ham, 180 g pesto and 70 g basil. |

Both large fixtures demonstrate internal production and purchased-aggregate
shortages in one run, covering the AI01 calculation part of AI06 AS03. Pesto
stays indivisible: its shortage is replenishment, with no production batches
or ingredient expansion. AI06 will add the catalogue sources and mixed-source
provenance required by its integrated acceptance scenario.

The `briefcase` fixture adapts `pizza-BOM.pl` and the first IARTI support deck.
Repeated parts such as two locks become explicit ingredient quantities. Working
stock is passed through the calculation as values, preserving repeatability and
isolation between concurrent calls.

AI01 accepts pizza BOM demand as its root and does not stock finished pizzas.
The classroom assembly is therefore placed inside a synthetic training BOM
(`teaching-assembly`, `training-size`) with one briefcase per requested unit.
The briefcase itself is an aggregate, so its 10 stocked units are used before
expanding the remaining 50. This is a training adapter, not a catalogue pizza.
The module does not expose the teacher's generic `manage_stock(Q, P, LWS, LOS)`
interface for arbitrary assembly roots such as `lid`.

The tests cover the numerical examples, shared ingredients, purchased aggregates,
cycles even under sufficient stock, invalid and missing inputs, personalised
configurations, execution-mode validation, LWS/LOS projections, the S13 order
example, concurrent calls and exact large integer arithmetic. The local value
tests demonstrate independent calls without global stock mutation. Backend
public execution access and saved calculation results still require AI05.

## AI06: inputs obtained by Prolog over HTTP

AI06 follows the client clarification supplied with the implementation: the
portal invokes Prolog with selectors and scheduling context. Prolog requests
business data from authorised API endpoints and builds the request-local KB.
The Backoffice does not push a complete business dataset on invocation.

The flow is:

1. The caller registers its selection with the internal input records adapter.
2. `planning_inputs:load_inputs/2` looks for retained inputs. A sealed retry or
   replay reuses them. Only a known unsealed current run opens a new capture.
3. Prolog opens a read view and requests selected products, sizes, composition,
   consumption, recipes and stock. Current reads share a read-only PostgreSQL
   transaction. Recipes are followed even when aggregate stock is sufficient.
4. `input_mapper.pl` validates and builds `bom/4`, `item/6`, `recipe/3`, `stock/2`
   and the other `planning_input` fields. AI02 quotes use exact integer cents.
5. The records adapter retains the first valid candidate. Prolog builds the KB
   from the retained winner and hands it to AI01 or AI02.

| File | Purpose |
| --- | --- |
| `src/planning_inputs.pl` | Input lifecycle, selected-ID traversal, fresh capture, retained retry and replay. |
| `src/input_http.pl` | Authorised HTTP requests, HTTPS policy, timeout, redirect rejection and JSON decoding. |
| `src/input_mapper.pl` | Source validation, size-specific BOM identity, exact price conversion and Prolog terms. |
| `src/input_validation.pl` | Shared input checks and structured diagnostics. |
| `src/json_boundary.pl` | Shared exact-integer transport guard. |
| `demo_inputs.pl` / `demo_inputs.mjs` | Local portal/source stand-in that invokes Prolog with selectors and shows the loaded input and AI01 result. |
| `tools/export_http_fixtures.pl` | Development exporter for the versioned HTTP fixtures; not imported by the running adapter. |

### Run the HTTP demonstrations

Install the existing backend dependencies with `npm --prefix backend ci`.
SWI-Prolog and Node.js are required. These demonstrations start a loopback
Backoffice source API with temporary credentials and in-memory retained inputs.
They do not connect to your database.

```sh
node ai/demo_inputs.mjs five-medium
node ai/demo_inputs.mjs personalized
node ai/demo_inputs.mjs chained-dough
node ai/demo_inputs.mjs iarti
node ai/demo_inputs.mjs iarti --planning
node ai/demo_inputs.mjs daily-sales --planning
```

Use `--trace` to print the HTTP methods, paths and status codes to stderr.
If `swipl` is not on PATH, set `SWIPL` to its executable path before running.
The five-pizza case still gives 600 g required, 400 g covered and 200 g missing.
The large case loads 24 BOMs, two production recipes and 23 planning items;
purchased pesto has 180 g missing. Its planning input has 63 supplier offers.
`daily-sales` also has a tracked drink consuming two stock units per sale, plus
offers with zero, finite and omitted daily capacity. The planning demos execute AI02 and return its result in `requirementsPlan`.

### Connect to the Backoffice

Run `npm --prefix backend run db:migrate` to apply the planning migrations on your selected
Backoffice database. Configure distinct `PLANNING_SERVICE_READ_TOKEN` and
`PLANNING_RECORDS_TOKEN` values in the backend environment; empty values leave
the optional internal API disabled. Never send these tokens to the SPA.

Tracked live products need an explicitly configured stock-unit code, and tracked
direct sales need a consumption factor. Prepare, for example:

```json
[{"productId":"PROD-00123","stockUnit":"g","stockUnitsPerSale":120}]
```

Use the existing product ID and the unit actually configured for that product.
Apply the file with `node backend/scripts/configure-planning-products.js <file>`
from an environment with the backend database configuration loaded. This changes
planning settings only. It never changes stock. Missing settings cause an input
diagnostic, not a guessed unit or consumption factor.

Configure Prolog with `LAPRIZZA_INPUT_API_URL` (including `/api/v1`, no trailing
slash), `LAPRIZZA_INPUT_READ_TOKEN` and `LAPRIZZA_INPUT_RECORDS_TOKEN`. HTTPS is
required except for loopback HTTP demonstrations. The internal contracts are
registered in the backend OpenAPI and detailed in the AI06 documentation.

Bundled fixtures are `five-medium@1`, `personalized@1`, `chained-dough@1`, `daily-sales@1` and
`iarti-demo@2`. They are explicit simulations, read through the same API. To use
custom versioned demonstration demand with existing catalogue IDs, configure a
`PLANNING_FIXTURE_DIRECTORY` containing source JSON documents. Fixture versions
are loaded at API startup and remain immutable for that process. A changed
dataset requires a new version and restart; a missing version is an error.

Additional preparation fixtures use product IDs distinct from the selected
catalogue. A collision returns `FIXTURE_PRODUCT_CONFLICT`; it cannot replace an
inactive current product or change its units. Prolog checks provenance for each
selected input group against the source references and view timestamp. Missing
stock/demand provenance cannot be covered by the offers' provenance.

The current catalogue, size configuration and stock adapters are implemented.
Saved stock must state `stockUnit` on each balance. AI06 checks it against the
catalogue unit before retaining the inputs.

The backend stores confirmed supplier versions through the private WEB07
confirmation route described in the AI06 contract. Select the exact version by
ID and version. For bundled supplier demonstrations, set
`supplierScenario.type` to `fixture`.

The order/forecast and pending-delivery demonstrations use versioned fixtures.
The `demandReader.read` and `incomingReader.read` ports connect their operational
sources. AI02 inputs include
unreceived deliveries as `pending_receipt(ReceiptId, ProductId, RemainingUnits, Date)`.
Their quantities never increase `opening_stock`. The optional `receipts` selector
follows the stock source when omitted; saved fixtures explicitly declare
`pendingDeliveries: []` when none exist. A missing feed is an error.
No current-data failure falls back to a
fixture. Fresh operational demand requires current catalogue eligibility;
simulated stock alone does not grant a historical exception.

### Test AI06

```sh
swipl -q -s ai/tests/bom_tests.pl -s ai/tests/input_mapper_tests.pl -g run_tests -t halt
node ai/tests/json_boundary_tests.mjs
node ai/tests/input_integration_tests.mjs
```

The Node test scripts also accept a portable SWI-Prolog executable as their first
argument. Backend API and PostgreSQL tests run with
`npm --prefix backend test -- --runInBand tests/integration/planning-inputs`.
PostgreSQL tests require `RUN_DATABASE_TESTS=1` and a dedicated `PGDATABASE`
ending in `_test`; each suite creates and removes its own schema. Set `SWIPL`
to enable the additional PostgreSQL → HTTP → Prolog → AI01 case.

The shared CI workflow installs the backend dependencies and runs these suites
with SWI-Prolog, Node.js and PostgreSQL. It is reused by scheduled CI and the
deployment validation gate. Public AI05 Manager/session checks, calculation
result storage and a shared Prolog HTTP server remain AI05 integration work.

[AI01 requirements and design](../docs/user_stories/ai/ai01/usAI01.md) ·
[AI06 input contract](../docs/user_stories/ai/ai06/usAI06.md#44-data-mapping-to-prolog)

## AI02 daily replenishment

Run either versioned simulation from the repository root with the existing backend dependencies installed.

```sh
node ai/demo_inputs.mjs daily-sales --planning
node ai/demo_inputs.mjs iarti --planning
swipl -q -s ai/tests/requirements_planning_tests.pl -g run_tests -t halt
```

The daily-sales plan buys €5.00 of cheese and €8.50 of drinks. The 63-offer IARTI scenario buys €33.20 and covers both forecast days on time. Each demo starts a local input service and prints JSON. The supplied scenarios carry their own fixed reference date and simulation provenance.

Prolog callers use `requirements_planning:requirements_plan(+Input, -Outcome)` with the sealed dictionary returned by AI06. Success returns `ok(Plan)`, including partial plans. A rejected input returns `error(Diagnostic)`. Each product/day records opening and closing balances, quantities fulfilled on time and late, outstanding units, and the sources used. Proposal costs use integer cents. The `calendar` field includes every date in the forecast. See [AI02 implementation and verification](../docs/user_stories/ai/ai02/usAI02.md#5-implementation) for allocation policy, search bounds and integration coverage.
