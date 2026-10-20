# Petty Cash — Backend PRD

**Audience:** backend developers and their AI coding agent
**Stack:** NestJS (REST, JSON), relational database (PostgreSQL recommended), your existing auth
**Frontend:** Nuxt 3 app at `pages/float/*` (this repo). The UI is complete and currently runs on an in-memory mock store (`stores/useFloatStore.ts`). This document describes what the backend must provide so that mock can be replaced with real API calls.
**Status:** Ready for build
**Related:** `FLOAT_PRD.md` in this folder is the original stakeholder PRD. Where the two disagree, **this document wins**: it describes the flows as they were built and agreed in the UI.

---

## 0. How to use this document (for the AI agent)

1. Read sections 1–4 to understand the domain, the people and the request lifecycle.
2. Section 5 is the **state machine**. Every write endpoint must go through it. Never set `status` directly from a DTO.
3. Section 6 is the **ledger**. Every movement of physical cash must write exactly one ledger row, in the same database transaction as the status change.
4. Section 7 walks through each screen and the action behind each button. Section 8 is the endpoint list. Section 9 is the data model.
5. Build in the order given in section 13. Each phase ends with the acceptance tests in section 12 for that phase.
6. Keep field names identical to the frontend types in `types/float.ts` (camelCase). Section 10 lists the few additions.

**Invariants you must not break**

- Money never appears or disappears: `vault balance = opening balance + top-ups − cash issued + cash returned − reimbursements ± adjustments`.
- The ledger is append-only. Corrections are new rows, never edits or deletes.
- Cash leaves the vault when the requester **confirms receipt**, not when Finance clicks *Notify*.
- A request can only be edited while it is `pending_approval`.
- Receipts can only be added or removed while the request is `cash_issued` or `returned_for_correction`.
- Every state change writes a timeline (audit) entry.

---

## 1. Purpose

Petty cash moves between two departments only:

- **GS (General Services / Procurement)** asks for cash, buys things, and brings back invoices and any change.
- **Finance** holds the cash in a vault, hands it out, takes back invoices and change, closes the request, and counts the vault regularly.

The system replaces the paper form and signatures with an auditable digital record, and keeps a running ledger of the physical cash in the vault.

## 2. People and roles

The current UI shows **every page to everyone** (no role switcher). The backend must still enforce who may do what, and tell the UI which buttons to show (see `allowedActions`, section 8.1).

| Role | Code | Typical person | Can do |
|---|---|---|---|
| GS Requester | `GS_REQUESTER` | GS staff | Create and edit own requests (before approval), confirm receipt of cash, add/remove receipts, settle |
| GS Manager | `GS_MANAGER` | Head of GS | Authorize or reject requests |
| Finance Staff | `FINANCE_STAFF` | Finance officer / cashier | Notify for collection, send reminders, return settlement for correction, finalize & close, record vault counts, record top-ups |
| Finance Supervisor | `FINANCE_SUPERVISOR` | Finance manager | Everything Finance Staff can do, plus resolve vault discrepancies (ledger adjustments) |

Rules:

- A user may hold more than one role.
- **Separation of duties** (recommended, make configurable): a GS Manager cannot authorize their own request; the Finance user who finalizes a request should not be its requester.
- Read access: everyone with any Petty Cash role can read all requests, the ledger and vault counts (the UI shows these to all).

## 3. Glossary

| Term in UI | Field / concept | Meaning |
|---|---|---|
| Voucher no | `id` | Human-readable request number, e.g. `PC-2026-0042` |
| Particulars | `purpose` | What the cash is for |
| Requested petty cash | `requestedAmount` | Amount the requester asked for |
| Needed by | `estimatedClosingDate` (and `effectiveClosingDate`) | Date the requester needs the cash by |
| Amount being given | `approvedAmount` | Amount Finance decides to hand over at *Notify*; can differ from requested |
| Disbursed / cash received | `totalCashIssued` | Cash actually handed over (set on collection) |
| Receipts | `expenses[]` | Invoices for purchases made with the cash |
| Settle | `submitForClosure` | Requester says "I'm done": hands invoices and change to Finance |
| Finalize & close | `closeRequest` | Finance counts the change, records it, closes the request |
| Balance to return | computed | `max(0, totalCashIssued − sum(expenses))` |
| Owed to requester / overspend | computed | `max(0, sum(expenses) − totalCashIssued)` |
| Dynamics reference | `dynamicsReference` | Optional Microsoft Dynamics voucher number, entered manually at Finalize |
| Vault / Ledger | `fund`, `transactions[]` | The physical cash Finance holds and its movements |
| Vault count / Reconciliation | `reconciliations[]` | A physical count of the vault compared with the ledger balance |
| Cash with GS staff | computed | Sum of `totalCashIssued` on requests in `cash_issued`, `returned_for_correction`, `pending_closure` |

## 4. End-to-end flow

```
GS Requester            GS Manager            Finance                       Ledger
------------            ----------            -------                       ------
Create request  ──►  pending_approval
(edit allowed)          │
                        ├─ Reject ──► rejected (end)
                        └─ Authorize ──► pending_finance
                                              │
                                   Notify for collection
                                   (amount, reason if ≠)
                                              ▼
                                       ready_for_collection
Confirm receipt  ───────────────────────────────────────────►  − cash issued
        ▼
   cash_issued
Add / remove receipts
Settle ─────────────────────────────►  pending_closure
                                              │
                         ┌────────────────────┼────────────────────┐
              Return for correction     Finalize & close      Send reminder
              (note) ─► returned_       (count change,        (while cash_issued
              for_correction             optional Dynamics      or returned_for_
              (requester fixes,          ref)                   correction)
               settles again)                 ▼
                                            closed  ─────────────►  + cash returned
                                                                    or − reimbursement
Weekly (or more often): Finance counts the vault → balanced / discrepancy → Supervisor resolves (± adjustment)
Any time: Finance records a top-up → + top-up
```

## 5. Request state machine

### 5.1 Statuses

| Status | UI label | Meaning |
|---|---|---|
| `pending_approval` | Pending GS approval | Waiting for GS Manager |
| `rejected` | Rejected | GS Manager rejected it (terminal) |
| `pending_finance` | Pending disbursement | Authorized, Finance hasn't prepared cash yet |
| `ready_for_collection` | Pending user collection | Finance prepared the cash and notified the requester |
| `cash_issued` | Disbursed | Requester confirmed receipt; cash is out |
| `returned_for_correction` | Needs correction | Finance sent the settlement back |
| `pending_closure` | Settled | Requester settled; waiting for Finance to finalize |
| `closed` | Closed | Finance finalized (terminal) |

`draft` and `cancelled` exist in the frontend types but have **no UI** yet. Implement them in the enum; don't build endpoints for them in this release (see section 11).

### 5.2 Transitions

| # | From | Action | To | Who | Endpoint | Side effects |
|---|---|---|---|---|---|---|
| T1 | — | Create | `pending_approval` | GS Requester | `POST /float/requests` | Voucher number, timeline `created` |
| T2 | `pending_approval` | Edit | `pending_approval` | Requester (owner) | `PATCH /float/requests/:id` | Timeline lists what changed |
| T3 | `pending_approval` | Authorize | `pending_finance` | GS Manager | `POST /float/requests/:id/authorize` | Timeline `approved`, notify Finance |
| T4 | `pending_approval` | Reject | `rejected` | GS Manager | `POST /float/requests/:id/reject` | `rejectionReason`, timeline, notify requester |
| T5 | `pending_finance` | Notify for collection | `ready_for_collection` | Finance | `POST /float/requests/:id/notify-collection` | Sets `approvedAmount`; timeline; notify requester. **No ledger entry.** |
| T6 | `ready_for_collection` | Confirm receipt | `cash_issued` | Requester (owner) | `POST /float/requests/:id/confirm-receipt` | Create issuance (acknowledged), `totalCashIssued += approvedAmount`, **ledger `cash_issued` (−)** |
| T7 | `cash_issued`, `returned_for_correction` | Add receipt | same | Requester (owner) | `POST /float/requests/:id/expenses` | Timeline `expense_added` |
| T8 | `cash_issued`, `returned_for_correction` | Remove receipt | same | Requester (owner) | `DELETE /float/requests/:id/expenses/:expenseId` | Timeline |
| T9 | `cash_issued`, `returned_for_correction` | Settle | `pending_closure` | Requester (owner) | `POST /float/requests/:id/settle` | Clears `correctionNote`; timeline; notify Finance |
| T10 | `cash_issued`, `returned_for_correction` | Send reminder | same | Finance | `POST /float/requests/:id/reminders` | Timeline `reminder`; notify requester |
| T11 | `pending_closure` | Return for correction | `returned_for_correction` | Finance | `POST /float/requests/:id/return-for-correction` | `correctionNote`; timeline `expense_returned`; notify requester |
| T12 | `pending_closure` | Finalize & close | `closed` | Finance | `POST /float/requests/:id/finalize` | Cash return (+) **or** reimbursement (−) ledger row; optional `dynamicsReference`; `closedBy`, `closedAt`; timeline; notify requester |

Any other (status, action) pair must return **409 Conflict** with a message such as `"Request PC-2026-0042 is Disbursed; it can't be authorized."`

Implement transitions in one place (for example `RequestStateMachine` with a `transitions` map), and call it from each service method inside a DB transaction.

## 6. Money and the ledger

### 6.1 Money format

- Currency is always **MVR**. Store amounts as `NUMERIC(14,2)` (or integer laari, 1 MVR = 100 laari). Never use floating point for arithmetic in the backend.
- API sends and receives amounts as JSON numbers in MVR with at most 2 decimals (the frontend already uses numbers). Validate `> 0` and at most 2 decimals.

### 6.2 Fund

One fund for now (`FUND-MVR-01`), but key everything by `fundId` so more can be added.

| Field | Meaning |
|---|---|
| `openingBalance`, `effectiveDate` | Set once when the fund starts (also written as an `opening_balance` ledger row) |
| `currentExpectedBalance` | **Cash that should be in the vault right now.** Always equals the `runningBalance` of the latest ledger row. |
| `custodian`, `name`, `description` | Display |

### 6.3 Ledger rows (`FundTransaction`)

| `type` | Sign | Written when | `requestId` | Reference |
|---|---|---|---|---|
| `opening_balance` | + | Fund created | — | Given |
| `top_up` | + | Finance records a top-up | — | Bank voucher / cheque no. (required) |
| `cash_issued` | − | Requester confirms receipt (T6) | yes | `dynamicsReference` or voucher no |
| `cash_returned` | + | Finalize when change is returned (T12) | yes | `dynamicsReference` or voucher no |
| `reimbursement` | − | Finalize when requester overspent (T12) | yes | `dynamicsReference` or voucher no |
| `adjustment` | ± | Supervisor resolves a vault discrepancy and chooses to adjust | — | `ADJ-<countId>` |

Writing a ledger row, always inside the same DB transaction as the business change:

1. `SELECT … FROM fund WHERE id = :fundId FOR UPDATE` (lock the fund row).
2. `newBalance = fund.currentExpectedBalance + amount` (amount is signed).
3. Insert the transaction with `runningBalance = newBalance`.
4. Update `fund.currentExpectedBalance = newBalance`.

Ledger rows are never updated or deleted. A negative vault balance should be rejected with 409 (Finance can't hand out cash it doesn't have). Make this a configurable check.

### 6.4 Request money rules

```
received      = totalCashIssued                       (set at T6)
spent         = sum(expenses.amount)
balanceToReturn = max(0, received − spent)
overspend     = max(0, spent − received)
```

At **Finalize** (T12):

- If `overspend > 0`: write one `reimbursement` row for `−overspend`. No cash count is taken.
- Else if `balanceToReturn > 0`: Finance counts the change by denomination. Write a `CashReturn` record (`expectedAmount = balanceToReturn`, `actualAmount = counted`, `difference = counted − expected`) and one `cash_returned` ledger row for `+actualAmount`. A non-zero difference is allowed ("Close with discrepancy") but must be stored on the `CashReturn` and shown in the timeline.
- Else (spent exactly what was received): no ledger row.

### 6.5 Derived figures the UI shows

| Figure | Formula |
|---|---|
| Cash in vault | `fund.currentExpectedBalance` |
| Out with GS staff | `sum(totalCashIssued)` for requests in `cash_issued`, `returned_for_correction`, `pending_closure` |
| Stat: Pending GS approval | count `pending_approval` |
| Stat: Pending disbursement | count `pending_finance` + `ready_for_collection` |
| Stat: Unsettled petty cash | count `cash_issued` + `returned_for_correction` |
| Stat: Awaiting closure | count `pending_closure` |

## 7. Screens and actions

Navigation (left menu): **Requests**, **GS Approvals**, **Finance Desk**, **History**, **Reconciliation**, **Ledger**. Plus the **Request page** (`/float/requests/:id`). On phones lists become cards and stat cards are hidden; on wide screens (≥1280px) lists look like tables. None of this changes the API.

### 7.1 Requests (`/float`) — `pages/float/index.vue`

Shows: the four stat cards; **My Active Petty Cash** = the current user's requests that are not `closed`, `rejected` or `cancelled`, newest first.

Columns: Date (`createdAt`), Voucher no, Particulars, Petty cash (`approvedAmount || requestedAmount`), Status, Action.

| Button | Shown when | Does | Endpoint |
|---|---|---|---|
| **Petty cash request** | always | Opens form: Particulars/description (required), Requested petty cash MVR (required, > 0), Needed by (required date, today or later; defaults to today) | `POST /float/requests` |
| **Edit** | `pending_approval` | Same form, prefilled. Save is disabled until something changes | `PATCH /float/requests/:id` |
| **Confirm receipt** | `ready_for_collection` | Requester confirms they received the cash | `POST /float/requests/:id/confirm-receipt` |
| **Add receipts** / **Correct receipts** | `cash_issued` / `returned_for_correction` | Opens the request page | — |

### 7.2 GS Approvals (`/float/approvals`) — `pages/float/approvals.vue`

Shows: stat cards; all `pending_approval` requests. Columns: Voucher no, Requester, Particulars (+ created date), Petty cash, Decision.

| Button | Does | Endpoint |
|---|---|---|
| **Authorize** | Approves straight away | `POST …/authorize` |
| **Reject** | Opens a dialog with an optional reason (server default: `"Rejected by GS."`) | `POST …/reject` |

### 7.3 Finance Desk (`/float/finance`) — `pages/float/finance.vue`

Shows: stat cards; four tabs. Columns: Voucher no, Requester, Particulars, Petty cash (`totalCashIssued || approvedAmount || requestedAmount`), Status, Action.

| Tab | Statuses | Action per row |
|---|---|---|
| **Heads-up** | `pending_approval` | None (read-only preview of what's coming) |
| **Pending Disbursement** | `pending_finance`, `ready_for_collection` | `pending_finance` → **Notify for collection**; `ready_for_collection` → status pill only |
| **Disbursed** | `cash_issued`, `returned_for_correction` | **Send reminder** |
| **Settled** | `pending_closure` | **Finalize** (opens the request page) |

**Notify for collection** dialog (`components/float/NotifyCollectionModal.vue`):

- Shows voucher no, requester, particulars, requested amount.
- *Amount being given (MVR)*: required, > 0, prefilled with the requested amount.
- If the amount differs from `requestedAmount`, a *Reason* is **required**.
- Endpoint: `POST …/notify-collection` with `{ amount, reason? }`. Sets `approvedAmount = amount`. The timeline must record the requested amount and the reason when they differ.
- Dynamics reference is **not** entered here (moved to Finalize).

### 7.4 History (`/float/requests`) — `pages/float/requests/index.vue`

Shows **closed requests only**, newest `closedAt` first, 10 per page, with search across voucher no, particulars, requester name and Dynamics ref.

Columns: Closed (`closedAt`), Voucher no, Particulars, Petty cash, Dynamics ref, Download.

| Button | Does | Endpoint |
|---|---|---|
| **PDF** | Downloads the voucher PDF | Data: `GET /float/requests/:id` (PDF is generated in the browser today; see 8.8) |

### 7.5 Request page (`/float/requests/:id`) — `pages/float/requests/[id]/index.vue`

Shows: status, amount (labelled *Requested amount* before approval, *Approved amount* after), details (voucher no, particulars, requester, submitted date, needed by, Dynamics voucher when set, notes), receipts with totals (Received / Spent / Balance to return or Owed to requester), Settlement Audit card (when `pending_closure`), activity timeline.

Header buttons by status:

| Status | Buttons |
|---|---|
| `pending_approval` | **Edit** (owner), **Reject**, **Authorize** (GS Manager) |
| `pending_finance` | **Notify for collection** (Finance) |
| `ready_for_collection` | **I received MVR {approvedAmount}** (owner) |
| `cash_issued`, `returned_for_correction` | **Add receipt**, **Settle** (owner) |
| `pending_closure` | Side card: **Finalize & close**, **Return for correction** (Finance) |
| `closed` | **Download PDF** |

**Add receipt** (`components/float/ReceiptScanModal.vue`). Three ways in:

1. **Take photo** (phone camera) or 2. **Attach file** (image or PDF): the file is uploaded and read by OCR, which pre-fills the form for the user to check.
3. **Enter details without a file**: manual entry; the receipt is flagged *No attachment*.

Fields: Vendor (required), Date (required), Total MVR (required, > 0), Invoice no (optional; server may generate one), Category (one of the list below), What was bought (required).

Categories: `Office Supplies`, `Hospitality & Food`, `Hardware & Tools`, `Transport & Delivery`, `Maintenance & Repairs`, `Printing & Stationery`.

Endpoints: `POST /float/files` (upload) → `POST /float/ocr/receipts` (optional, returns suggestions) → `POST …/expenses`. Remove: `DELETE …/expenses/:expenseId`.

**Settle** dialog: shows Received / Spent / To return (or *Owed to you*). Settling with zero receipts is allowed (the UI warns the full amount must be returned). Endpoint: `POST …/settle`.

**Return for correction** dialog: *What needs fixing?* (required). Endpoint: `POST …/return-for-correction` with `{ note }`. The note is shown to the requester as a banner (`correctionNote`).

**Finalize & close** dialog (`components/float/BanknoteCounter.vue`):

- Shows cash received and receipts count/total.
- Overspend → message "Reimburse the requester", button **Pay {overspend} & close**.
- Nothing to return → message, button **Confirm & close**.
- Otherwise → banknote counter. Denominations: MVR 1,000 / 500 / 100 / 50 / 20 / 10 / 5 notes; MVR 2 / 1 coins. Shows pieces counted, total counted, expected, difference. Button **Confirm & close** when it balances, **Close with discrepancy** when it doesn't.
- *Dynamics reference (optional)*, prefilled if the request already has one.
- Endpoint: `POST …/finalize` with `{ denominations?, dynamicsReference? }`. The **server** recomputes everything (expected, counted, overspend) from its own data and the denominations; it must not trust totals sent by the client.

### 7.6 Reconciliation (`/float/reconciliation`) — `pages/float/reconciliation.vue`

Shows: Expected vault cash, Last count (days ago; flagged "due" after 7 days), Fund status (Balanced / Discrepancy pending); count history.

Columns: Date, Counted by (+ notes), Ledger, Counted, Difference, Status (Balanced / Discrepancy / Resolved), Action.

| Button | Does | Endpoint |
|---|---|---|
| **Record Physical Count** | Count by denomination (notes 1000…5, coins 2 and 1, optional rare coins 0.50 / 0.25 / 0.10 / 0.01) + notes. Expected = current ledger balance | `POST /float/vault-counts` |
| **Resolve** (row, discrepancy only) | Reason (required) + toggle *Adjust ledger to the counted amount* (default on) | `POST /float/vault-counts/:id/resolve` |
| **Generate report** | Downloads a PDF: fund summary, latest count by denomination, count history, full ledger | Data: `GET /float/reports/reconciliation` |

### 7.7 Ledger (`/float/fund`) — `pages/float/fund.vue`

Shows: Cash in vault, Out with GS staff, Opening balance (with date); transactions newest first, 5 per page.

Columns: Date, Type, Description (+ recorded by; links to the request when there is one), Reference, Amount (signed), Balance.

| Button | Does | Endpoint |
|---|---|---|
| **Top-Up Fund** | Amount (required), Funding reference / voucher no (required), Notes | `POST /float/fund/top-ups` |

## 8. API

Base path: **`/float`** (the frontend will proxy it as `/api/float/...` through Nuxt, the same way `stores/casemanagement/cases.ts` calls `/api/casemanagement/...`).

### 8.1 Conventions

- JSON, camelCase, ISO 8601 timestamps in UTC (`2026-10-19T08:30:00Z`). Plain dates (`neededBy`, `expenseDate`) as `YYYY-MM-DD`. Business timezone is **Indian/Maldives (UTC+5)**. Use it for "today", "due" and report dates.
- Auth: your existing auth guard. Role checks via a `@Roles()` decorator + `RolesGuard`; ownership checks (requester = current user) in the service.
- **Pagination** (matches `types/caseManagement.ts`):
  ```ts
  interface PaginatedResponse<T> { data: T[]; total: number; page: number; pageSize: number }
  ```
  Query: `?page=1&pageSize=10`.
- **Errors** (matches `types/caseManagement.ts`):
  ```ts
  interface ApiError { message: string; errors?: Record<string, string[]>; statusCode: number }
  ```
  400 validation (with `errors` per field), 401, 403 (role/ownership), 404, **409** (invalid state transition, concurrent update, would make vault negative).
- **`allowedActions`**: every request returned by the API includes `allowedActions: string[]` computed for the current user from status + role + ownership, e.g. `["edit","authorize","reject"]`. The UI uses it to decide which buttons to show. Values: `edit`, `authorize`, `reject`, `notifyCollection`, `confirmReceipt`, `addExpense`, `removeExpense`, `settle`, `sendReminder`, `returnForCorrection`, `finalize`, `downloadPdf`.
- **Concurrency**: requests carry a `version` integer. Mutating endpoints accept `expectedVersion` (optional) and return 409 if stale. Always bump `version` on change.
- **Idempotency**: money-moving endpoints (`confirm-receipt`, `finalize`, `top-ups`, `vault-counts/:id/resolve`) accept an `Idempotency-Key` header. A repeated key returns the original result without writing again.
- Every mutating endpoint returns the **full updated resource** so the UI can replace its copy.

### 8.2 Requests

| Method | Path | Role | Body | Returns |
|---|---|---|---|---|
| GET | `/float/requests` | any | Query: `status` (comma list), `requesterId` or `mine=true`, `q`, `sort` (`createdAt`, `closedAt`), `order`, `page`, `pageSize` | `PaginatedResponse<PettyCashRequestSummary>` |
| GET | `/float/requests/:id` | any | — | `PettyCashRequest` (with expenses, issuances, returns, timeline, `allowedActions`) |
| POST | `/float/requests` | GS_REQUESTER | `{ purpose, requestedAmount, neededBy }` | `PettyCashRequest` |
| PATCH | `/float/requests/:id` | owner | `{ purpose?, requestedAmount?, neededBy?, expectedVersion? }` | `PettyCashRequest` |
| POST | `/float/requests/:id/authorize` | GS_MANAGER | `{}` | `PettyCashRequest` |
| POST | `/float/requests/:id/reject` | GS_MANAGER | `{ reason? }` | `PettyCashRequest` |
| POST | `/float/requests/:id/notify-collection` | FINANCE_* | `{ amount, reason? }` (reason required if amount ≠ requested) | `PettyCashRequest` |
| POST | `/float/requests/:id/confirm-receipt` | owner | `{}` | `PettyCashRequest` |
| POST | `/float/requests/:id/expenses` | owner | `CreateExpenseDto` | `PettyCashRequest` |
| DELETE | `/float/requests/:id/expenses/:expenseId` | owner | — | `PettyCashRequest` |
| POST | `/float/requests/:id/settle` | owner | `{}` | `PettyCashRequest` |
| POST | `/float/requests/:id/reminders` | FINANCE_* | `{}` | `PettyCashRequest` |
| POST | `/float/requests/:id/return-for-correction` | FINANCE_* | `{ note }` | `PettyCashRequest` |
| POST | `/float/requests/:id/finalize` | FINANCE_* | `{ denominations?, dynamicsReference? }` | `PettyCashRequest` |

List presets the UI needs (all via `GET /float/requests`):

| Screen | Query |
|---|---|
| Requests → My Active Petty Cash | `mine=true&status=pending_approval,pending_finance,ready_for_collection,cash_issued,returned_for_correction,pending_closure` |
| GS Approvals | `status=pending_approval` |
| Finance Desk tabs | `status=pending_approval` / `pending_finance,ready_for_collection` / `cash_issued,returned_for_correction` / `pending_closure` |
| History | `status=closed&sort=closedAt&order=desc&q=…&page=…` |

### 8.3 Receipts, files and OCR

| Method | Path | Role | Body | Returns |
|---|---|---|---|---|
| POST | `/float/files` | any | `multipart/form-data` `file` (jpeg, png, heic, webp, pdf; max 10 MB) | `{ fileId, fileName, contentType, size, url }` |
| GET | `/float/files/:fileId` | any | — | File stream (signed URL or proxied) |
| POST | `/float/ocr/receipts` | any | `{ fileId }` | `{ supplierName?, invoiceNumber?, amount?, expenseDate?, confidence }` |

`CreateExpenseDto`:

```ts
{
  supplierName: string;      // required
  expenseDate: string;       // YYYY-MM-DD, required, not in the future
  amount: number;            // required, > 0
  description: string;       // required
  category?: ExpenseCategory;
  invoiceNumber?: string;    // server generates one if missing
  fileId?: string;           // omit for "Enter details without a file"
  ocrConfidence?: number;    // 0–100, when the user started from OCR
}
```

OCR is a suggestion only. The user always reviews and can change every field. If OCR is not available, return 501 and the UI falls back to manual entry. Store `ocrExtracted = !!fileId && ocrConfidence != null`.

### 8.4 Fund and ledger

| Method | Path | Role | Body | Returns |
|---|---|---|---|---|
| GET | `/float/fund` | any | — | `PettyCashFund & { cashWithStaff: number }` |
| GET | `/float/fund/transactions` | any | `page`, `pageSize`, `type?`, `from?`, `to?` | `PaginatedResponse<FundTransaction>` newest first |
| POST | `/float/fund/top-ups` | FINANCE_* | `{ amount, reference, notes? }` | `FundTransaction` |

### 8.5 Vault counts (reconciliation)

| Method | Path | Role | Body | Returns |
|---|---|---|---|---|
| GET | `/float/vault-counts` | any | `page`, `pageSize` | `PaginatedResponse<DailyReconciliation>` newest first |
| POST | `/float/vault-counts` | FINANCE_* | `{ denominations: DenominationCounts, notes? }` | `DailyReconciliation` |
| POST | `/float/vault-counts/:id/resolve` | FINANCE_SUPERVISOR | `{ resolutionNotes, adjustLedger: boolean }` | `DailyReconciliation` |

Rules:

- `expectedBalance` = `fund.currentExpectedBalance` at the moment of saving (read under the fund row lock).
- `actualCashCount` = sum of denominations (server computes; never trust a client total).
- `status = 'balanced'` if difference is 0, else `'discrepancy_pending'`.
- Resolve: only from `discrepancy_pending`. If `adjustLedger`, write an `adjustment` row for `difference` (so the ledger matches the count). Set `resolvedAt`, `resolvedBy`, `status = 'resolved'`.

### 8.6 Stats

| Method | Path | Returns |
|---|---|---|
| GET | `/float/stats` | `{ pendingApproval, pendingDisbursement, unsettled, awaitingClosure, cashInVault, cashWithStaff, lastCountAt, unresolvedDiscrepancies }` |

### 8.7 Current user

| Method | Path | Returns |
|---|---|---|
| GET | `/float/me` | `{ id, name, email, department, roles: Role[] }` |

### 8.8 Reports and PDFs

The UI generates both PDFs in the browser (`utils/floatPdf.ts`, using `html2pdf.js`). The backend only has to return the data:

| Method | Path | Returns |
|---|---|---|
| GET | `/float/requests/:id` | Voucher data (request must be `closed` for the PDF button to show) |
| GET | `/float/reports/reconciliation?from&to` | `{ fund, cashWithStaff, totals: { topUps, cashIssued, cashReturned, reimbursements, adjustments }, latestCount, counts, transactions, generatedAt, preparedBy }` |

Optional later: server-side PDFs (`GET /float/requests/:id/pdf`, `GET /float/reports/reconciliation.pdf`) for archiving or emailing. If you add them, match the layout of the client PDFs.

## 9. Data model

Names follow `types/float.ts`. Suggested tables (adapt to your ORM, TypeORM or Prisma).

### `float_fund`
`id` PK (text, e.g. `FUND-MVR-01`) · `name` · `currency` (`MVR`) · `opening_balance` numeric · `effective_date` date · `current_expected_balance` numeric · `custodian` · `description` · `created_at` · `updated_at`

### `float_request`
`id` PK text (`PC-YYYY-NNNN`) · `fund_id` FK · `purpose` text · `department` · `requester_id` FK user · `status` enum · `requested_amount` numeric · `approved_amount` numeric default 0 · `total_cash_issued` numeric default 0 · `estimated_closing_date` date (needed by) · `effective_closing_date` date · `dynamics_reference` text null · `notes` · `rejection_reason` · `correction_note` · `cancellation_reason` · `closure_notes` · `closed_by` FK user · `closed_at` · `version` int · `created_at` · `updated_at`

Indexes: `(status)`, `(requester_id, status)`, `(closed_at desc)`, trigram/full-text on `purpose` for search.

Voucher numbers: `PC-{YYYY}-{NNNN}`, sequence **per calendar year**, generated inside the insert transaction (sequence table or `SELECT … FOR UPDATE` on a counter row). Never reuse numbers.

### `float_cash_issuance`
`id` · `request_id` FK · `amount` · `issued_by` · `issued_at` · `acknowledged_by` · `acknowledged_at` · `is_additional` bool · `notes`
(One row is written at T6, already acknowledged. `is_additional` is reserved for the future "additional cash" feature.)

### `float_expense`
`id` · `request_id` FK · `supplier_name` · `category` · `invoice_number` · `expense_date` date · `amount` · `description` · `file_id` FK null · `ocr_extracted` bool · `ocr_confidence` int null · `verification_status` enum (`submitted`, `verified`, `returned_for_correction`, `rejected`; default `submitted`) · `correction_note` · `verified_by` · `verified_at` · `created_at`

### `float_cash_return`
`id` · `request_id` FK · `expected_amount` · `actual_amount` · `difference` · `denominations` jsonb · `received_by` · `returned_by` · `return_date` · `notes` · `acknowledged` bool

### `float_fund_transaction` (append-only)
`id` · `fund_id` FK · `type` enum (`opening_balance`, `top_up`, `cash_issued`, `cash_returned`, `reimbursement`, `adjustment`) · `amount` numeric signed · `running_balance` numeric · `date` timestamptz · `request_id` FK null · `reference` · `notes` · `recorded_by` FK user · `created_at`
Revoke UPDATE/DELETE on this table for the app's DB user, or enforce with a trigger.

### `float_vault_count` (`DailyReconciliation`)
`id` · `fund_id` FK · `count_date` timestamptz · `expected_balance` · `actual_cash_count` · `difference` · `denominations` jsonb · `counted_by` · `notes` · `status` enum (`balanced`, `discrepancy_pending`, `resolved`) · `resolved_by` · `resolved_at` · `resolution_notes` · `adjustment_transaction_id` FK null

`denominations` keys and values (MVR): `note1000` 1000, `note500` 500, `note100` 100, `note50` 50, `note20` 20, `note10` 10, `note5` 5, `coin2` 2, `coin1` 1, `coin0_5` 0.50, `coin0_25` 0.25, `coin0_10` 0.10, `coin0_1` 0.01 (1 laari). The server computes totals from these; never accept a client total.

### `float_timeline_event` (audit)
`id` · `request_id` FK · `type` · `title` · `description` · `actor_id` · `actor_name` · `actor_role` · `metadata` jsonb · `created_at`

Timeline `type` values used by the UI: `created`, `approved`, `rejected`, `finance_processed`, `handover`, `acknowledged`, `expense_added`, `expense_returned`, `return_recorded`, `closed`, `reminder`. Also defined: `expense_verified`, `additional_requested`, `additional_approved`, `additional_issued`, `cancelled`, `extended`.

Suggested titles (the UI shows them as written):

| Event | Title | Description should include |
|---|---|---|
| T1 | Request Created & Submitted | requester, amount |
| T2 | Request Edited | each change, e.g. "amount from MVR 1,850 to MVR 2,000" |
| T3 | Approved by Manager | approver |
| T4 | Rejected | reason |
| T5 | Cash Prepared for Collection | amount; requested amount and reason if different |
| T6 | Cash Handed Over + Cash Receipt Acknowledged | amount |
| T7 | Expense Recorded | vendor, amount |
| T9 | Submitted for Financial Closure | — |
| T10 | Settlement Reminder Sent | amount outstanding |
| T11 | Settlement Returned for Correction | note |
| T12 | Cash Return Recorded & Acknowledged / Overspend Reimbursed, then Request Closed | counted vs expected or reimbursed amount; Dynamics ref |

## 10. Response shapes

Use the interfaces in `types/float.ts` as the contract. Additions and clarifications:

```ts
// PettyCashRequest (additions)
correctionNote?: string;          // already in types/float.ts
allowedActions: string[];         // new, see 8.1
version: number;                  // new
requester: { id; name; email; avatar? };   // embed, don't make the UI fetch users

// PettyCashRequestSummary (list rows; omit heavy arrays)
Omit<PettyCashRequest, 'expenses' | 'issuances' | 'returns' | 'timeline' | 'additionalCashRequests'>
  & { expenseCount: number; expenseTotal: number }

// ExpenseItem
receiptUrl?: string;              // short-lived URL from /float/files/:fileId
receiptFileName?: string;         // undefined = "No attachment" in the UI

// ActivityTimelineItem.timestamp: ISO string (UI formats it)
```

Keep `fundId`, `closingDateExtensions`, `additionalCashRequests` in the payload (empty arrays are fine) so the existing types still match.

## 11. Out of scope for this release

These exist in the types or the original PRD but have **no UI** yet. Don't build endpoints; keep schema room for them.

- Additional cash on an active request (`additionalCashRequests`, `is_additional` issuances)
- Cancelling a request (`cancelled`, `cancellationReason`)
- Extending the needed-by date after approval (`closingDateExtensions`)
- Per-receipt verification by Finance (`verificationStatus` stays `submitted`; correction is per settlement)
- Drafts
- Microsoft Dynamics integration (reference is typed by hand at Finalize)
- Multiple funds in the UI

### 11.1 Notifications

The UI only shows toasts today. Backend should emit domain events, then deliver in-app and/or email through your existing notification service:

| Event | Recipient |
|---|---|
| Request created / edited | GS Managers |
| Authorized | Finance staff; requester |
| Rejected | Requester |
| Notify for collection | Requester ("Your MVR X is ready at the Finance counter") |
| Reminder | Requester |
| Settled | Finance staff |
| Returned for correction | Requester (include the note) |
| Closed | Requester |
| Vault count with discrepancy | Finance supervisors |
| No vault count for 7 days | Finance staff (daily job) |

Rate-limit reminders: at most one per request per 24 hours (409 otherwise, with the time of the last one).

## 12. Acceptance tests

Seed: fund opening balance MVR 25,000, vault 18,450.

1. **Happy path, change returned.** Create 850 → authorize → notify 850 → confirm receipt: vault 17,600, ledger `cash_issued −850`, status `cash_issued`. Add receipt 630 → settle → finalize with 2×100 + 1×20 = 220: `cash_returned +220`, vault 17,820, status `closed`, `CashReturn.difference = 0`.
2. **Overspend.** Issued 850, receipts 900 → finalize with no denominations: `reimbursement −50`, vault 17,550.
3. **Spent exactly.** Issued 500, receipts 500 → finalize: no ledger row, closed.
4. **Discrepancy at finalize.** Expected 220, counted 200: `cash_returned +200`, `CashReturn.difference = −20`, closed, timeline mentions the difference.
5. **Notify with a different amount.** Requested 5,000, notify 4,500 without reason → 400; with reason → `approvedAmount = 4500`; confirm receipt debits 4,500.
6. **Notify writes no ledger row.** Ledger unchanged after T5; changes only after T6.
7. **Edit rules.** PATCH in `pending_approval` OK (timeline lists changes); PATCH after authorize → 409; PATCH by non-owner → 403; `neededBy` in the past → 400.
8. **Receipts rules.** Add a receipt in `pending_closure` → 409; in `returned_for_correction` → OK.
9. **Return for correction.** `pending_closure` → return with note → `returned_for_correction`, `correctionNote` set; settle again → `pending_closure`, `correctionNote` cleared.
10. **Invalid transitions.** Authorize a `closed` request → 409; confirm receipt twice → second is 409 (or idempotent replay with same key).
11. **Vault count.** Count 17,000 against 17,550 → `discrepancy_pending`, difference −550. Resolve with `adjustLedger=true` → `adjustment −550`, vault 17,000, status `resolved`. Resolve without adjust → status `resolved`, ledger unchanged.
12. **Top-up.** +5,000 with reference → vault +5,000, row type `top_up`.
13. **History.** Only `closed` requests, sorted by `closedAt` desc, search by Dynamics ref works.
14. **Ledger invariant** (property test): after any random sequence of valid actions, `fund.currentExpectedBalance` equals the last `runningBalance` and equals the signed sum of all ledger rows.
15. **Concurrency.** Two finalize calls at once on the same request: exactly one succeeds, one ledger row.
16. **Permissions.** Requester cannot authorize; GS Manager cannot authorize own request (if separation of duties is on); Finance Staff cannot resolve a discrepancy; `allowedActions` matches what each role may do.

## 13. Suggested NestJS structure and build order

```
src/float/
  float.module.ts
  common/            roles.decorator.ts, roles.guard.ts, money.ts (decimal helpers), idempotency.interceptor.ts
  requests/          requests.controller.ts, requests.service.ts, request-state-machine.ts, dto/*.dto.ts
  expenses/          expenses.service.ts, dto/create-expense.dto.ts
  files/             files.controller.ts (upload/download), ocr.service.ts (pluggable provider)
  fund/              fund.controller.ts, ledger.service.ts (the ONLY place that writes fund_transaction)
  vault-counts/      vault-counts.controller.ts, vault-counts.service.ts
  stats/             stats.controller.ts
  reports/           reports.controller.ts
  timeline/          timeline.service.ts
  notifications/     float-events.ts, float-notifications.listener.ts (@nestjs/event-emitter)
```

Use `class-validator` DTOs, for example:

```ts
export class NotifyCollectionDto {
  @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() amount: number;
  // Required when amount ≠ request.requestedAmount. The DTO can't see the request, so check it in the service.
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class FinalizeDto {
  @IsOptional() @ValidateNested() @Type(() => DenominationCountsDto) denominations?: DenominationCountsDto;
  @IsOptional() @IsString() @MaxLength(50) dynamicsReference?: string;
}
```

Build order:

1. **Foundation:** schema + migrations, seed (fund, opening balance, sample users per role), `RolesGuard`, `GET /float/me`, error filter producing `ApiError`.
2. **Ledger:** `LedgerService.post()` with row lock, fund endpoints, top-ups. Tests 12 and 14.
3. **Requests to cash out:** create, edit, list/detail with `allowedActions`, authorize, reject, notify, confirm receipt. Tests 5–7, 10, 16.
4. **Receipts and settlement:** files, OCR stub, expenses, settle, reminders, return for correction. Tests 8–9.
5. **Finalize:** cash return / reimbursement / no-op, Dynamics ref. Tests 1–4, 15.
6. **Vault counts:** record, resolve, reconciliation report data. Test 11.
7. **History, stats, notifications.** Test 13.

## 14. Frontend integration guide

The frontend currently calls a Pinia store with mock data. Integration means replacing each store action with an API call and the store's arrays with fetched data. Mapping:

| Store (`stores/useFloatStore.ts`) | Endpoint |
|---|---|
| `requests`, `allRequests` | `GET /float/requests` (with the presets in 8.2) |
| `getRequestById(id)` | `GET /float/requests/:id` |
| `createRequest({ purpose, requestedAmount, estimatedClosingDate })` | `POST /float/requests` (`neededBy = estimatedClosingDate`) |
| `updateRequest(id, { purpose, requestedAmount, neededBy })` | `PATCH /float/requests/:id` |
| `approveRequestByManager(id)` | `POST …/authorize` |
| `rejectRequestByManager(id, reason)` | `POST …/reject` |
| `prepareCashByFinance(id, { approvedAmount, notes })` | `POST …/notify-collection` `{ amount, reason }` |
| `collectCash(id)` | `POST …/confirm-receipt` |
| `addExpense(id, …)` / `deleteExpense(id, expenseId)` | `POST …/expenses` / `DELETE …/expenses/:expenseId` |
| `simulateOCR(fileName)` | `POST /float/files` then `POST /float/ocr/receipts` |
| `submitForClosure(id)` | `POST …/settle` |
| `sendReminder(id)` | `POST …/reminders` |
| `returnSettlementForCorrection(id, note)` | `POST …/return-for-correction` |
| `recordCashReturn` + `recordReimbursement` + `closeRequest(id, _, dynamicsRef)` | **one call:** `POST …/finalize` `{ denominations, dynamicsReference }` |
| `fund`, `cashWithStaff` | `GET /float/fund` |
| `transactions` | `GET /float/fund/transactions` |
| `addFundTopUp(…)` | `POST /float/fund/top-ups` |
| `reconciliations` | `GET /float/vault-counts` |
| `recordDailyCount(…)` | `POST /float/vault-counts` |
| `resolveDiscrepancy(id, { resolutionNotes, adjustmentAmount })` | `POST /float/vault-counts/:id/resolve` `{ resolutionNotes, adjustLedger: adjustmentAmount !== 0 }` |
| `fundOverview`, stat counts | `GET /float/stats` |
| `currentUser` | `GET /float/me` |

Notes for whoever wires the frontend:

- The UI already does the maths for display (balance to return, overspend, counted total). Keep it for instant feedback, but always render the server's response after a write.
- Replace `v-if="item.status === …"` button checks with `allowedActions.includes(…)` so permissions come from the server.
- On 409, show the server `message` as a toast and refetch the request.
- Send an `Idempotency-Key` (e.g. `crypto.randomUUID()` per dialog open) on confirm receipt, finalize, top-up and resolve.
- Receipt photos: upload first (`/float/files`), keep the returned `fileId`, then create the expense with it.
- PDFs stay client-side; they read the same request/report data.

## 15. Open questions

1. Should GS Managers be able to see and act on Finance Desk, and Finance see GS Approvals? (The UI shows all pages to everyone; `allowedActions` will hide buttons.)
2. Separation of duties: block self-authorization and self-finalization, or only warn?
3. Should a negative vault balance be blocked (recommended) or only flagged?
4. Who receives notifications: individual users or department mailboxes?
5. Retention for receipt files and how long signed URLs stay valid.
6. Does Finance need a maximum per-request amount (e.g. MVR 5,000) that needs supervisor sign-off?
