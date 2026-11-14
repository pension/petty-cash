# **Petty Cash Management System**

## **Product Requirements Document (PRD)**

**Organization:** Maldives Pension Administration Office (MPAO)  
 **Product:** Petty Cash Management System  
 **Version:** 1.0  
 **Status:** Draft for stakeholder review  
 **Primary departments:** General Services (GS / Procurement) and Finance

---

# **1\. Executive Summary**

The Petty Cash Management System will digitize and centralize the process of requesting, approving, issuing, spending, returning, and reconciling petty cash within MPAO.

Currently, petty cash transactions are managed using physical forms. GS staff complete request forms, GS managers approve them, Finance prepares and hands over cash, and GS staff subsequently return unused cash with invoices and supporting documents. Signatures on the physical form provide evidence of approvals and cash handovers.

Finance also performs physical cash counts and tracks issued forms to maintain accountability for the petty cash fund.

The proposed system will replace this paper-based workflow with a digital process that provides clear ownership, traceable approvals, documented cash movements, supporting-document management, and financial reconciliation.

The system will be optimized for mobile use, particularly for GS staff recording purchases and uploading receipts. OCR-assisted data extraction will reduce manual data entry when recording invoices and receipts.

The system will also maintain a reference to the corresponding record in Microsoft Dynamics. The initial release will not integrate directly with Dynamics; Finance staff will enter the relevant Dynamics reference manually.

## **1.1 Product Vision**

Provide a reliable, auditable, and efficient way to manage petty cash from the initial request through final financial reconciliation.

## **1.2 Primary Objectives**

1. Eliminate dependence on physical petty cash forms and handwritten signatures.  
2. Digitize the approval and cash handover process.  
3. Establish clear accountability for cash issued to staff.  
4. Simplify expense recording and supporting-document submission.  
5. Enable Finance to reconcile individual requests and the overall petty cash fund.  
6. Improve visibility into outstanding, overdue, and pending requests.  
7. Maintain an auditable history of financial transactions and approvals.  
8. Reduce manual data entry through mobile document capture and OCR.

---

# **2\. Problem Statement**

The current petty cash process relies on physical documents and manual coordination between GS and Finance.

This creates several operational challenges:

* Request status is difficult to monitor without locating the physical form or contacting the responsible department.  
* Approval, cash preparation, collection, and return depend on manual handovers.  
* Invoices and supporting documents must be physically attached to the form.  
* Finance needs to track issued forms and identify cash that has not yet been accounted for.  
* Daily cash counts require comparison between physical cash and manually maintained records.  
* Changes to approved or issued amounts need to be documented without losing the original transaction history.  
* Managers and Finance staff lack a consolidated view of pending work and outstanding cash.

The new system should establish a single digital record for each request and its associated financial activity.

---

# **3\. Scope**

## **3.1 In Scope**

The initial product will include:

* User authentication and role-based access.  
* Petty cash request creation and submission.  
* GS manager approval and rejection.  
* Finance processing and cash preparation.  
* Cash handover and receipt acknowledgment.  
* Manual entry of Dynamics reference numbers.  
* Expense recording.  
* Invoice and receipt uploads.  
* OCR-assisted expense data extraction.  
* Expense verification by Finance.  
* Cash return recording and acknowledgment.  
* Request closure.  
* Request cancellation and full cash return workflows.  
* Additional cash requests and approval.  
* Closing-date management and extensions.  
* Petty cash fund opening balance.  
* Fund transaction ledger.  
* Fund top-ups.  
* Daily cash reconciliation.  
* Weekly cash-count support, subject to confirmation of the operational procedure.  
* Dashboards, pending-work lists, and basic reports.  
* Notifications for relevant workflow events.  
* Audit history.

## **3.2 Out of Scope for the Initial Release**

The following are excluded unless subsequently approved:

* Direct integration with Microsoft Dynamics.  
* Automatic posting of transactions to Dynamics.  
* Automated bank transfers or electronic disbursements.  
* Supplier payment processing.  
* Procurement purchase-order management.  
* Inventory and stock management.  
* General ledger accounting.  
* Advanced accounting exports or automated journal entries.  
* Automated approval of expenses using OCR or AI.  
* Complex multi-fund allocation and inter-fund transfers beyond confirmed operational requirements.

The system will record the petty cash activity and references needed for the existing financial process without attempting to replace Dynamics or the organization’s accounting system.

---

# **4\. User Roles and Permissions**

The system will initially support four operational roles.

## **4.1 GS Requester**

A GS requester is responsible for initiating a petty cash request, receiving the issued cash, recording expenses, submitting supporting documents, and returning unused cash.

Permissions:

* Create and edit their own draft requests.  
* Submit requests for approval.  
* View the status of their requests.  
* Confirm receipt of issued cash.  
* Record expenses against active requests.  
* Upload and correct receipt information.  
* Request additional cash.  
* Request an extension to the closing date if permitted by policy.  
* Submit requests for financial closure.  
* Request cancellation or full return of issued cash.  
* Respond to requests for correction from Finance.

Requesters must not approve their own requests unless an explicit organizational policy permits an exception.

## **4.2 GS Manager**

The GS manager reviews and approves requests submitted by GS staff.

Permissions:

* View requests submitted by their department.  
* Approve or reject new requests.  
* Approve or reject requests for additional cash.  
* Review the requested amount and purpose.  
* View the department’s active and overdue requests.  
* View relevant request and approval history.

Additional approval requirements for extensions or cancellations will be configurable according to the agreed policy.

## **4.3 Finance Staff**

Finance staff manage the petty cash issuance and return process and maintain the fund records.

Permissions:

* View approved requests awaiting processing.  
* Record the approved and issued amounts.  
* Enter Dynamics reference numbers.  
* Record cash preparation.  
* Mark cash as handed over.  
* Record cash returns and partial returns.  
* Acknowledge cash received.  
* Review expenses and supporting documents.  
* Request corrections to submitted expenses.  
* Verify expenses.  
* Close reconciled requests.  
* Process eligible cancellations.  
* Manage fund transactions and top-ups, subject to assigned permissions.  
* Record physical cash counts.  
* View fund balances, outstanding cash, and reconciliation discrepancies.

## **4.4 Finance Supervisor / Authorized Finance User**

This role represents an authorized reviewer for sensitive financial actions.

The exact approval requirements must be confirmed with Finance.

Potential permissions include:

* Review and resolve reconciliation discrepancies.  
* Approve adjustments or controlled corrections.  
* Authorize reopening a closed request.  
* Review cancellations involving previously issued cash.  
* Review or approve fund adjustments.  
* Review audit history and financial reports.

These permissions should not automatically be granted to all Finance staff.

---

# **5\. Core Business Concepts**

The system must distinguish between the following entities.

## **5.1 Petty Cash Request**

Represents the business purpose for which GS requests cash.

It contains the requester, purpose, requested amount, approvals, expected closing date, expenses, supporting documents, and overall lifecycle status.

## **5.2 Cash Issuance**

Represents an actual handover of cash from Finance to GS.

A request may have more than one issuance if additional cash is approved later.

Each issuance must have its own amount, date, responsible Finance staff member, and receipt acknowledgment.

## **5.3 Expense**

Represents an individual purchase made using the issued cash.

Each expense may have one or more supporting documents and its own verification status.

## **5.4 Cash Return**

Represents cash returned by GS to Finance.

A request may have multiple returns if partial returns are permitted.

Each return must record the expected amount, actual amount received, recipient, date, and any discrepancy.

## **5.5 Petty Cash Fund**

Represents the fund physically controlled by Finance.

It has an opening balance and a ledger of financial movements.

## **5.6 Fund Transaction**

Represents a recorded movement affecting the physical cash balance, such as:

* Cash issued to GS.  
* Cash returned by GS.  
* Fund top-up.  
* Authorized fund adjustment.

The system must not treat a request status change as a substitute for a financial transaction record.

## **5.7 Cash Reconciliation**

Represents a physical count of the fund compared with the expected balance calculated from recorded cash movements.

## **5.8 Audit Event**

Represents a recorded action or change to a request, approval, expense, issuance, return, or fund record.

---

# **6\. Petty Cash Request Workflow**

## **6.1 Step 1: Create Request**

The GS requester creates a new request.

Required fields:

* Request purpose.  
* Requested amount.  
* Estimated closing date.

Automatically populated fields:

* Unique request number.  
* Requester identity.  
* Department.  
* Creation timestamp.

Optional fields:

* Supporting documents.  
* Notes.

The requester may save the request as a draft and return to complete it later.

The requester submits the completed request to the GS manager.

## **6.2 Step 2: Manager Approval**

The GS manager reviews the submitted request.

The manager can:

* Approve the request.  
* Reject the request with a reason.

An approved request proceeds to Finance.

A rejected request returns to the requester with the rejection reason and remains part of the audit history.

The original requested amount must be preserved.

## **6.3 Step 3: Finance Processing**

Finance reviews the approved request.

Finance records:

* Approved amount, where applicable.  
* Amount prepared for issuance.  
* Petty cash fund reference.  
* Dynamics reference number.  
* Expected closing date.  
* Relevant notes.

The actual issued amount may differ from the originally requested amount, subject to the applicable approval rules.

Finance marks the cash as ready for collection.

The requester is notified.

## **6.4 Step 4: Cash Handover**

Finance hands the cash to the requester.

Finance records the actual amount handed over and confirms the handover in the system.

The requester must then acknowledge receipt.

The system records:

* Amount handed over.  
* Finance staff member.  
* Handover timestamp.  
* Requester acknowledging receipt.  
* Receipt acknowledgment timestamp.

The request enters the Cash Issued state only after the handover has been recorded and the required receipt acknowledgment has been completed.

The system must distinguish between cash prepared, cash handed over, and cash acknowledged as received.

## **6.5 Step 5: Record Expenses**

The requester records purchases against the active request.

Each expense should contain:

* Description.  
* Supplier name, where available.  
* Invoice or receipt number, where available.  
* Expense date.  
* Amount.  
* Supporting document.  
* OCR extraction data, where applicable.  
* Verification status.

The requester can add expenses progressively rather than waiting until all purchases have been completed.

The system must distinguish between expenses submitted by GS and expenses verified by Finance.

## **6.6 Step 6: Submit for Closure**

When the requester has completed the purchases, the requester submits the request for financial closure.

The system calculates the current reconciliation figures.

At minimum:

* Total cash issued.  
* Total expenses submitted.  
* Total expenses verified.  
* Total cash returned.  
* Expected cash return.  
* Outstanding or unaccounted amount.

The system must clearly display any difference between the issued amount and the submitted expenses and cash returns.

## **6.7 Step 7: Cash Return**

The requester returns the unused cash to Finance.

Finance records the amount physically received and acknowledges the return.

The system records:

* Expected cash return.  
* Actual cash returned.  
* Received by.  
* Return date and time.  
* Any difference.  
* Explanation for the difference, where applicable.

The return transaction must be recorded even if the returned amount differs from the expected amount.

The system must not automatically treat a discrepancy as resolved.

## **6.8 Step 8: Finance Verification and Closure**

Finance reviews the submitted expenses, documents, and returned cash.

Finance verifies that:

* Expenses are adequately documented or have an authorized exception.  
* Cash returns are accurately recorded.  
* The request’s financial reconciliation is correct.  
* Outstanding discrepancies have been resolved or formally dispositioned according to policy.  
* Required supporting information is present.

Finance closes the request once the applicable closure requirements are satisfied.

Closed requests become read-only to ordinary users.

Any subsequent correction must follow the controlled correction or reopening process.

---

# **7\. Request Statuses**

The application will use a controlled set of statuses.

| Status | Description |
| ----- | ----- |
| Draft | Request is being prepared by GS. |
| Pending Approval | Awaiting GS manager decision. |
| Rejected | Request has been rejected. |
| Pending Finance | Approved request is awaiting Finance processing. |
| Ready for Collection | Finance has prepared the cash. |
| Cash Issued | Cash handover and receipt acknowledgment are complete. |
| Pending Closure | GS has submitted expenses and closure information for Finance review. |
| Returned for Correction | Finance requires additional information or corrections. |
| Closed | Finance has completed the required verification and closure process. |
| Cancelled | The request has been cancelled under the applicable rules. |

Additional cash requests will have their own approval status and history rather than replacing the original request’s status.

A request may also have flags or calculated indicators such as:

* Due soon.  
* Overdue.  
* Reconciliation discrepancy.  
* Additional cash pending approval.  
* Additional cash awaiting issuance.

These indicators should not create unnecessary new lifecycle statuses.

---

# **8\. Additional Cash Requests**

## **8.1 Purpose**

A requester may discover that the original issued amount is insufficient.

For example, GS receives MVR 1,000 but determines that an additional MVR 200 is required.

The requester must submit an additional cash request rather than directly editing the original issuance.

## **8.2 Workflow**

1. The requester opens the active petty cash request.  
2. The requester selects Request Additional Cash.  
3. The requester enters the additional amount and justification.  
4. The request is submitted to the GS manager.  
5. The GS manager approves or rejects the additional amount.  
6. Once approved, the additional request proceeds to Finance.  
7. Finance prepares and hands over the additional cash.  
8. The requester acknowledges receipt.  
9. The additional issuance is recorded against the original petty cash request.

Finance must not issue the additional amount until the required manager approval is recorded.

## **8.3 Financial Record**

The system must preserve each issuance separately.

Example:

| Item | Amount |
| ----- | ----- |
| Original issuance | MVR 1,000 |
| Additional issuance | MVR 200 |
| Total cash issued | MVR 1,200 |

The original issuance must not be overwritten.

The request’s financial calculations must use the cumulative amount actually issued.

---

# **9\. Request Cancellation and Full Cash Return**

Cancellation and cash return are separate concepts.

Cancellation changes the business status of a request. Cash return records the physical movement of money back to Finance.

The system must preserve both events.

## **9.1 Cancellation Before Cash Issuance**

If the request has not been issued to GS, it may be cancelled according to the applicable authorization rules.

If cash has been prepared but not handed over, Finance must record the cancellation and ensure the prepared amount is not recorded as issued cash.

## **9.2 Cancellation After Cash Issuance**

If GS has already received cash, the request cannot be cancelled immediately.

The workflow must be:

1. An authorized user initiates a cancellation request.  
2. The reason for cancellation is recorded.  
3. GS returns the entire outstanding issued amount, subject to the applicable accounting rules.  
4. Finance records the cash actually received.  
5. Finance verifies the amount against the cash outstanding.  
6. Finance acknowledges receipt.  
7. The system confirms that the required financial conditions have been satisfied.  
8. The authorized user completes the cancellation.

If the full required amount has not been returned, the request remains financially outstanding and cannot be finalized as cancelled.

Any discrepancy must be handled according to Finance policy.

## **9.3 Cancellation Audit**

The system must retain:

* Original request.  
* Original approvals.  
* All cash issuances.  
* Cancellation reason.  
* Cash return transactions.  
* Finance acknowledgment.  
* Cancellation timestamp.  
* Person completing the cancellation.

Cancellation must not delete or erase the original request.

---

# **10\. Expenses and OCR**

## **10.1 Expense Entry**

GS staff must be able to record expenses using a mobile-friendly interface.

The user should be able to:

* Capture a receipt or invoice using the device camera.  
* Upload an existing image or supported document.  
* Review OCR-extracted information.  
* Correct extracted values.  
* Confirm and save the expense.  
* Add additional expenses to the same request.

## **10.2 OCR Fields**

The OCR process should attempt to extract:

* Supplier name.  
* Invoice or receipt number.  
* Document date.  
* Total amount.

Additional fields may be introduced if the chosen OCR solution supports them reliably and Finance finds them useful.

## **10.3 OCR Validation**

OCR output must be treated as unverified information.

The system must:

* Display extracted values for user review.  
* Allow manual correction.  
* Preserve the source document.  
* Avoid automatically approving or verifying expenses.  
* Make it possible for Finance to inspect the original document.

OCR failure must not prevent manual expense entry.

## **10.4 Expense Verification**

Finance reviews expenses and supporting documents.

Each expense may be marked as:

* Submitted.  
* Verified.  
* Returned for correction.  
* Rejected, where the applicable policy requires this outcome.

Finance should be able to provide a reason when returning an expense for correction.

The exact treatment of missing receipts, partial documentation, and exceptional expenses must follow Finance policy.

---

# **11\. Petty Cash Fund Management**

## **11.1 Opening Balance**

Finance records the opening cash balance when establishing the fund or initializing a new controlled accounting period.

The opening balance must include:

* Amount.  
* Effective date.  
* Fund identifier.  
* Recorded by.  
* Notes or supporting reference, where required.

Once posted, the opening balance must not be freely editable.

Corrections must use a controlled adjustment process.

## **11.2 Fund Transaction Ledger**

The system must maintain a ledger of cash movements.

Initial transaction types:

* Opening balance.  
* Cash issued.  
* Cash returned.  
* Fund top-up.  
* Authorized adjustment.

Each transaction must contain:

* Unique transaction identifier.  
* Fund identifier.  
* Transaction type.  
* Amount.  
* Date and time.  
* Related request, where applicable.  
* Recorded by.  
* Supporting reference.  
* Notes, where relevant.

The expected physical cash balance must be calculated from the opening balance and recorded cash movements.

## **11.3 Fund Top-Ups**

Finance must be able to record a top-up to the petty cash fund.

Required information:

* Amount.  
* Date.  
* Funding or transaction reference.  
* Recorded by.  
* Supporting documents, where applicable.  
* Notes.

A top-up increases the expected physical cash balance.

It is distinct from an individual petty cash issuance and must not create a GS request.

## **11.4 Available Cash**

The dashboard should display the expected physical cash currently held by Finance.

It should also distinguish cash that is outstanding with requesters.

These figures must not be combined.

---

# **12\. Cash Reconciliation**

## **12.1 Daily Cash Count**

Finance performs a physical count and compares the actual cash with the expected balance calculated by the system.

The reconciliation record must include:

* Fund.  
* Count date and time.  
* Expected balance.  
* Actual physical cash.  
* Difference.  
* Counted by.  
* Reviewer, if required.  
* Notes or discrepancy explanation.  
* Resolution status.

The expected balance must be calculated by the system, not manually entered by the person conducting the count.

## **12.2 Discrepancy Handling**

If the actual cash differs from the expected balance, the system must record and display the discrepancy.

The system must not silently adjust the fund balance to eliminate the difference.

A discrepancy may require:

* An explanation.  
* Investigation.  
* Review by an authorized Finance user.  
* An authorized adjustment, where appropriate.

The exact approval and resolution process remains subject to Finance policy.

## **12.3 Weekly Cash Count**

The system should support weekly cash-count records if Finance confirms that the weekly process is a separate control.

The weekly count should reference the fund and retain its own date, results, and audit history.

Whether the weekly count is a separate physical count or a review of daily counts must be confirmed before the final workflow is designed.

---

# **13\. Financial Calculations and Reconciliation Rules**

The application must distinguish between cash held by Finance, cash issued to GS, expenses, and returned cash.

## **13.1 Request-Level Reconciliation**

For a request:

**Total cash issued** \= Sum of all completed cash issuances.

**Total cash returned** \= Sum of all acknowledged cash returns.

**Expected cash return** \= Total cash issued − Total verified expenses.

**Unaccounted amount** \= Total cash issued − Total verified expenses − Total acknowledged cash returned.

These calculations are intended to support the financial workflow. The system must also display submitted but unverified expenses separately.

A request should not be considered financially reconciled merely because the requester has entered expenses that Finance has not yet verified.

Where the unaccounted amount is zero, the system must still confirm that all required documents and verification steps have been completed before closure.

## **13.2 Fund-Level Reconciliation**

**Expected physical cash** \= Opening balance \+ Cash returned to Finance \+ Fund top-ups \+ Authorized positive adjustments − Cash issued to GS − Authorized negative adjustments.

Only recorded financial movements should affect the expected balance.

Expense records should not independently change the physical cash balance, because the money left the fund when it was issued to GS. Expenses explain how that issued money was used; they do not represent additional physical cash movements at Finance.

## **13.3 Outstanding Cash**

Outstanding cash represents issued money that has not yet been accounted for through verified expenses and acknowledged returns.

It is not the same as overdue cash or a physical cash-count discrepancy.

The dashboard must report these concepts separately.

---

# **14\. Closing Date Management**

Each request must have an expected closing date.

The system should identify requests that are:

* Due soon.  
* Due today.  
* Overdue.  
* Closed.

Finance may extend the closing date according to the agreed policy.

When a date is extended, the system must preserve:

* Original closing date.  
* New closing date.  
* Person making the change.  
* Timestamp.  
* Reason for the extension.

The dashboard should use the current effective closing date to calculate overdue status while retaining the original date for audit and reporting.

An overdue request must remain open until the required closure or cancellation conditions are satisfied.

---

# **15\. Closed Request Controls**

Once a request is closed, ordinary users must not be able to modify its financial records.

The system must prevent silent changes to:

* Issued amounts.  
* Expense amounts.  
* Verified expenses.  
* Cash returns.  
* Approval history.  
* Supporting-document records.  
* Closing details.

If a correction is required, an authorized user must follow a controlled reopening or correction workflow.

The system must preserve the original values and record:

* Reason for correction.  
* User initiating the correction.  
* Authorized reviewer, if required.  
* Original values.  
* Corrected values.  
* Timestamp.  
* Resulting financial transactions, where applicable.

The system must not delete the original financial history.

---

# **16\. Dynamics Reference Management**

The system will not integrate directly with Microsoft Dynamics in the initial release.

Finance staff will manually enter the Dynamics reference associated with the corresponding record.

The application must maintain separate identifiers for:

* Internal petty cash request number.  
* Dynamics reference number.

The internal request number must be generated and managed by the application.

The Dynamics reference should be searchable and visible to authorized Finance users.

The requirement for a Dynamics reference before cash issuance or closure must be confirmed with Finance.

---

# **17\. Dashboards and Work Queues**

The application should prioritize actionable work rather than relying on large collections of charts.

## **17.1 Finance Dashboard**

The Finance dashboard should display:

### **Financial overview**

* Expected physical cash balance.  
* Outstanding cash with requesters.  
* Requests awaiting Finance processing.  
* Overdue requests.  
* Unresolved cash reconciliation discrepancies.

### **Pending work**

* Approved requests awaiting cash preparation.  
* Cash ready for collection.  
* Requests awaiting expense verification.  
* Requests awaiting cash return acknowledgment.  
* Requests awaiting closure.  
* Requests returned for correction.

### **Recent activity**

* Cash issuances.  
* Cash returns.  
* Fund top-ups.  
* Request closures.  
* Reconciliation discrepancies.

Financial figures should link to the relevant records or filtered lists.

## **17.2 GS Requester Dashboard**

The requester dashboard should display:

* Draft requests.  
* Requests awaiting manager approval.  
* Requests ready for collection.  
* Active requests with cash issued.  
* Requests requiring expenses or receipts.  
* Requests returned for correction.  
* Requests approaching their closing date.  
* Overdue requests.  
* Completed requests.

The primary action for each active request should be clear.

## **17.3 GS Manager Dashboard**

The manager dashboard should prioritize:

* Requests awaiting approval.  
* Additional cash requests awaiting approval.  
* Requests returned for correction.  
* Active requests within GS.  
* Requests approaching their closing dates.  
* Overdue requests.

Managers should be able to open a request and review the relevant details before approving or rejecting it.

---

# **18\. Request Detail Screen**

The request detail screen will be the central interface for reviewing a petty cash request.

It should include the following sections.

## **18.1 Request Summary**

* Internal request number.  
* Purpose.  
* Requester.  
* Current status.  
* Requested amount.  
* Total approved amount.  
* Total cash issued.  
* Current expected closing date.  
* Dynamics reference.

## **18.2 Financial Summary**

* Total cash issued.  
* Total expenses submitted.  
* Total expenses verified.  
* Expected cash return.  
* Total cash returned.  
* Unaccounted amount.

## **18.3 Expenses and Documents**

* Expense list.  
* Expense descriptions and amounts.  
* Receipt and invoice previews.  
* OCR-extracted values.  
* Verification status.  
* Correction notes.

## **18.4 Activity Timeline**

The timeline should show important events such as:

* Request creation.  
* Manager approval or rejection.  
* Finance processing.  
* Cash handover.  
* Receipt acknowledgment.  
* Additional cash approval and issuance.  
* Expense submission.  
* Cash return.  
* Finance verification.  
* Closure or cancellation.

Each event should identify the responsible person and timestamp.

## **18.5 Contextual Actions**

The interface should present actions appropriate to the current status and the user’s permissions.

Examples:

* Submit request.  
* Approve or reject.  
* Prepare cash.  
* Confirm handover.  
* Acknowledge cash receipt.  
* Request additional cash.  
* Add expense.  
* Submit for closure.  
* Record cash return.  
* Acknowledge return.  
* Request correction.  
* Close request.  
* Initiate cancellation.

Users must not see actions they are not authorized to perform.

---

# **19\. Notifications**

The system should provide notifications for important workflow events.

Initial notification events:

* Request submitted for approval.  
* Request approved or rejected.  
* Request awaiting Finance processing.  
* Cash ready for collection.  
* Cash issuance awaiting acknowledgment.  
* Additional cash request submitted.  
* Additional cash request approved or rejected.  
* Expense returned for correction.  
* Request submitted for closure.  
* Cash return acknowledged.  
* Request closed or cancelled.  
* Closing date approaching.  
* Request overdue.  
* Reconciliation discrepancy recorded.

Notification channels may include in-app notifications and email, depending on the available infrastructure and MPAO’s preferred communication channels.

Notifications must not replace the underlying audit records.

---

# **20\. Reporting**

The system should provide operational and financial reports.

Initial reports:

## **Request Reports**

* All petty cash requests.  
* Requests by status.  
* Requests by requester.  
* Requests by date range.  
* Requests by Dynamics reference.  
* Overdue requests.  
* Cancelled requests.

## **Cash Reports**

* Total cash issued.  
* Outstanding cash.  
* Cash returns.  
* Requests awaiting closure.  
* Fund top-ups.  
* Fund transaction history.

## **Expense Reports**

* Expenses by request.  
* Expenses by supplier, where supplier information is available.  
* Submitted versus verified expenses.  
* Requests with missing or incomplete supporting documents.

## **Reconciliation Reports**

* Daily cash-count history.  
* Weekly cash-count history, if applicable.  
* Cash discrepancies.  
* Unresolved discrepancies.  
* Authorized adjustments.

Reports must distinguish between submitted, verified, and finalized financial information.

Export formats and any required accounting-specific reports should be agreed with Finance before implementation.

---

# **21\. Auditability and Security**

Because the application manages public funds, auditability is a core requirement.

The system must:

* Associate important actions with an authenticated user.  
* Record timestamps for approvals, handovers, returns, and closures.  
* Preserve the original request and approval history.  
* Preserve each cash issuance and return as a separate transaction.  
* Record changes to financially significant fields.  
* Record reasons for rejection, correction, cancellation, and reopening where applicable.  
* Restrict fund adjustments and sensitive actions to authorized users.  
* Prevent unauthorized access to other users’ requests and documents.  
* Prevent silent modification or deletion of closed financial records.  
* Retain supporting documents according to MPAO’s applicable retention policy.

The application should use server-side authorization and validation. Hiding an action in the interface is not sufficient to enforce permissions.

---

# **22\. Non-Functional Requirements**

## **22.1 Mobile Usability**

The application must be optimized for mobile browsers, particularly for GS staff.

Receipt capture, expense entry, request status, and cash-return information must be accessible without navigating complex desktop-oriented layouts.

## **22.2 Reliability**

Financial records must not be lost or duplicated when users experience network interruptions or retry an action.

Operations that create cash transactions must be protected against accidental duplicate submissions.

## **22.3 Data Integrity**

Financial calculations must be consistent across the request detail screen, dashboards, reports, and fund ledger.

Amounts must use an appropriate decimal representation rather than floating-point arithmetic that could introduce rounding errors.

## **22.4 Performance**

Common tasks, including opening a request, uploading a receipt, recording an expense, and reviewing pending requests, should respond promptly under normal operating conditions.

Specific performance targets should be agreed during technical planning.

## **22.5 Accessibility**

The application should support keyboard navigation, readable contrast, clear validation messages, and appropriately labelled form controls.

Mobile interactions must not depend solely on color or visual position to communicate status.

## **22.6 Document Security**

Supporting documents must be stored securely and made available only to authorized users.

The system should validate supported file types and sizes and protect uploaded documents against unauthorized access.

---

# **23\. Acceptance Criteria**

The following criteria define the minimum expected behavior for the core product.

## **Request Creation and Approval**

* A GS requester can create and submit a petty cash request.  
* A submitted request is routed to the appropriate GS manager.  
* The manager can approve or reject the request.  
* Rejection requires a recorded reason.  
* The original requested amount is preserved.

## **Cash Issuance**

* Finance can record the amount prepared for collection.  
* Finance can record the actual amount handed over.  
* The requester can acknowledge receipt.  
* The request cannot be treated as issued before the required handover and acknowledgment steps are complete.  
* Each issuance is recorded separately.

## **Additional Cash**

* A requester can request additional cash against an active request.  
* The request includes an additional amount and justification.  
* The GS manager must approve the additional amount before Finance issues it.  
* Finance can record the additional issuance and the requester’s acknowledgment.  
* The original issuance remains unchanged.  
* The total issued amount reflects all completed issuances.

## **Expense Management**

* GS can add expenses and supporting documents to an active request.  
* GS can capture a receipt image using a mobile device.  
* OCR-extracted information can be reviewed and corrected.  
* OCR failure does not prevent manual expense entry.  
* Finance can verify an expense or return it for correction.  
* Submitted and verified expenses are distinguishable.

## **Cash Returns and Closure**

* Finance can record a cash return.  
* The actual returned amount is recorded independently of the expected amount.  
* Partial returns can be recorded if permitted by the configured business rules.  
* Finance can see the remaining amount to be accounted for.  
* A request cannot be closed while required reconciliation or verification conditions remain unmet.  
* Closure records the responsible Finance user and timestamp.

## **Cancellation**

* Cancellation is recorded separately from cash return.  
* A request with issued cash cannot be finalized as cancelled until the required return and verification conditions are satisfied.  
* The original request, issuance, and return history remain available after cancellation.  
* Cancellation does not delete financial records.

## **Fund Management**

* Finance can record an opening balance.  
* Finance can record fund top-ups.  
* Cash issuance decreases the expected physical cash balance.  
* Cash return increases the expected physical cash balance.  
* The expected balance is calculated from recorded fund transactions.  
* Fund transactions remain traceable to their source.

## **Reconciliation**

* Finance can record an actual physical cash count.  
* The system calculates the expected cash balance.  
* The system calculates and displays the difference.  
* A discrepancy cannot be silently eliminated by changing the expected balance.  
* Reconciliation history remains available.

## **Closing Date**

* Each applicable request has an expected closing date.  
* Finance can extend the date according to the configured policy.  
* The original date and each extension are retained in the history.  
* Overdue requests remain open until the required closure conditions are satisfied.

## **Audit and Access Control**

* Users can perform only actions permitted by their roles.  
* Important financial actions are associated with an authenticated user and timestamp.  
* Closed records cannot be silently edited by ordinary users.  
* Corrections and authorized reopening preserve the original history.

---

# **24\. Success Metrics**

The product’s effectiveness should be measured against the current paper-based process.

Proposed metrics:

1. **Digital processing rate:** Percentage of petty cash requests processed entirely through the system.  
2. **Approval turnaround time:** Time between request submission and manager decision.  
3. **Finance processing time:** Time between manager approval and cash readiness.  
4. **Closure turnaround time:** Time between expense submission and request closure.  
5. **Overdue request rate:** Percentage of open requests past their expected closing dates.  
6. **Reconciliation discrepancy rate:** Frequency of physical cash counts with differences.  
7. **Documentation completeness:** Percentage of closed requests with required supporting documents.  
8. **OCR correction rate:** Percentage of OCR-extracted fields that require user correction.  
9. **Outstanding cash visibility:** Percentage of active requests with up-to-date recorded issuance, expense, and return information.

Baseline values should be collected from the existing process before setting numerical targets.

---

# **25\. Open Questions and Decisions Required**

The following items must be resolved with GS and Finance before finalizing the detailed specification.

## **Financial Rules**

1. Is the petty cash fund maintained at a fixed target balance or allowed to vary?  
2. What is the approval policy when Finance issues an amount different from the original requested amount?  
3. Is a Dynamics reference required before issuance, before closure, or at another stage?  
4. What are the rules for accepting expenses without receipts?  
5. How should financial discrepancies be investigated, approved, and resolved?  
6. Who is authorized to reopen a closed request or post a financial adjustment?

## **Workflow Rules**

7. Can requesters submit multiple partial cash returns?  
8. Can expenses be submitted and verified progressively?  
9. Who can initiate cancellation at each stage?  
10. Does cancellation require manager approval in addition to Finance authorization?  
11. Does extending a closing date require GS manager approval?  
12. Can a request be reopened after closure, and under what circumstances?

## **Fund Management**

13. How many petty cash funds exist, and are they managed independently?  
14. Who is responsible for physical custody of each fund?  
15. What is the precise procedure for daily cash counts?  
16. Is the weekly count a separate physical count or a review of daily reconciliations?  
17. How is the fund replenished in the current process?

## **Technical and Operational**

18. What notification channels are available and preferred?  
19. What document types and file-size limits should be supported?  
20. What retention policy applies to requests, receipts, and audit records?  
21. What reporting and export formats does Finance require?

---

# **26\. Recommended Implementation Phases**

## **Phase 1: Core Workflow and Accountability**

* Authentication and role-based permissions.  
* Request creation and approval.  
* Finance processing.  
* Cash issuance and receipt acknowledgment.  
* Expense recording and document uploads.  
* Cash return recording.  
* Finance verification and closure.  
* Additional cash requests and manager approval.  
* Cancellation and full cash return workflow.  
* Dynamics reference management.  
* Request timeline and audit history.  
* Basic dashboards and notifications.

## **Phase 2: Fund Management**

* Opening balances.  
* Fund transaction ledger.  
* Fund top-ups.  
* Expected physical cash balance.  
* Outstanding cash calculations.  
* Fund activity reporting.

## **Phase 3: Reconciliation and Reporting**

* Daily cash counts.  
* Weekly cash-count workflow, once confirmed.  
* Discrepancy management.  
* Authorized adjustments.  
* Financial and operational reports.  
* Report exports.

## **Phase 4: Efficiency Improvements**

* OCR-assisted invoice and receipt entry.  
* Enhanced notifications and reminders.  
* Advanced filters and reporting.  
* Additional operational improvements identified through staff feedback.

The phases describe delivery priorities, not isolated data models. The initial architecture must support the financial ledger, multiple issuances, partial returns, and audit history from the beginning, even if some reporting and reconciliation screens are delivered later.

---

# **27\. Product Principles**

The following principles should guide implementation and future enhancements.

1. **One request, complete history:** Every request retains its approvals, issuances, expenses, returns, and closure history.  
2. **No silent financial changes:** Financially significant changes must be traceable.  
3. **Approval before additional issuance:** Additional cash requires GS manager approval before Finance issues it.  
4. **Cancellation is not deletion:** Cancelling a request must not erase the original request or financial activity.  
5. **Cash accountability is explicit:** Every issued amount must be accounted for through verified expenses, acknowledged returns, or an explicitly managed discrepancy.  
6. **Physical cash is reconciled independently:** Fund reconciliation compares the system’s expected physical cash with the actual count.  
7. **OCR assists rather than decides:** Extracted document data must be reviewed and verified.  
8. **Role-specific interfaces:** GS requesters, GS managers, and Finance staff should see the information and actions relevant to their responsibilities.  
9. **Mobile-first for operational tasks:** Receipt capture and expense entry should be practical on a phone.  
10. **Closure is controlled:** Closed financial records are read-only except through an authorized correction process.

---

## **Conclusion**

The Petty Cash Management System will replace the existing paper-based process with a traceable digital workflow while strengthening cash accountability and financial control.

The initial design should focus on the complete lifecycle of a petty cash request, including approval, issuance, additional cash, expense documentation, cash return, and closure. Fund management and reconciliation should be built on a reliable transaction ledger rather than inferred from request statuses.

The next step is to validate the open business rules with GS and Finance, then use the agreed requirements to produce the detailed user flows, screen specifications, and implementation backlog.

