# Petty Cash staff settings

The Settings page maintains two lists: requester and approver. Use **Add staff**, enter a work email, fetch the employee, review RCN, identifier/NID, name, email, designation and department, then confirm. Missing directory values display as “—”; lookup never creates employees or fabricates details. Designation structures are traversed to their Department ancestor. A missing Department ancestor yields an empty department.

Assignments use the person's Common/Bifrost entity ID rather than their email or active organisation ID. The same employee can appear in both types, but only once actively per type. Removing an entry sets removal time and actor, clears its active unique key and retains the historical snapshot. Re-adding inserts a new UUID and added date. The last active requester or approver cannot be removed. Initially both lists are empty; an authorized Settings administrator must add at least one real employee to each.

Frontend request creation, editing, collection, receipt entry/removal and settlement require a requester assignment as well as the existing permissions and ownership/state rules. Approval and rejection require an approver assignment plus their existing permissions/state rules. Receipt uploads and OCR require their individual permissions plus requester eligibility. Finance actions and page view permissions are unchanged. Backend business authorization continues to depend on Bifrost permissions, ownership and workflow state; these lists are not a new backend business authorization boundary.

Eligibility comes from `/access`, is cached for up to 30 seconds on navigation, refreshed every 60 seconds while visible, and freshly checked before affected submissions. Own assignment changes refresh it immediately. Identity changes discard cached data and late responses; refresh failures disable requester/approver actions. A removed user cannot submit affected actions through the frontend even if their already-open page has stale buttons.

## API and permissions

| Route | Permission suffix | Behavior |
| --- | --- | --- |
| GET /staff-assignments | staffassignments.list | Active assignment rows |
| POST /staff-assignments/lookup | staffassignments.lookup | `{email}` → employee details; no persistence |
| POST /staff-assignments | staffassignments.add | `{type, email, employeeId}` → confirmed assignment |
| DELETE /staff-assignments/:id | staffassignments.remove | Soft removal, retaining history |

All permissions have prefix `petty-cash.`. Identity and MPAO selection are mandatory. The main provisioning SQL grants all four permissions to the Finance role. The Request role receives none. Assign the Finance role to the appropriate users through Bifrost. Settings requires list permission to appear; adding also requires lookup permission.

Each mutation locks its pre-created `staff_assignment_types` row inside a transaction before checking active duplicates or remaining staff. This serializes concurrent removals across different employees of the same type and protects the last-person invariant. MySQL additionally enforces `(type, active_employee_id)` uniqueness and checks that the active key is present exactly for non-removed records. No gRPC request occurs while holding the lock.

## Cross-repository rollout

1. Release the additive `CommonService.FindStaffByEmail` contract from `/Users/naif/Code/Packages/proto` using that repository's normal release workflow. Existing RPCs and field numbers are unchanged. Local verification uses the rebuilt complete `dist` copied into the affected consumers, as required by the proto repository. The checked-in package version is not manually bumped; deployment must consume the release containing the new RPC before building consumers.
2. Deploy the common-grpc handler with the regenerated contract. It matches normalized work email against non-deleted, currently effective employees, rejects ambiguous matches, and returns only the fields needed by Settings. This is a lookup only.
3. Configure `COMMON_GRPC_URL` and `APP_ENV` using the same values/conventions as the working Employment API. Only `APP_ENV=production` uses TLS and Google service-account ID tokens; every other value uses insecure gRPC. In production, `COMMON_GRPC_URL` is passed unchanged to both the gRPC client and `getIdTokenClient` as the audience, matching Employment API. `COMMON_GRPC_AUDIENCE` is no longer used. The production runtime service account needs permission to invoke common-grpc. The client is registered at API startup through `ClientsModule.registerAsync`; missing target configuration or Google credential initialization errors fail startup. The maintenance CLI does not load this module.
4. Review and deploy the additive `20261021120000_staff_assignments` migration to the intended Petty Cash database. It creates new tables only and seeds the two lock rows, not any staff. Do not reset a database or copy ui-lab mock employees.
5. Run the permission provisioning SQL in Bifrost to grant the four Settings permissions to the Finance role, assign that role to the appropriate users, refresh sessions, and add at least one requester and approver. Deploy the frontend restrictions with this setup step coordinated: empty lists disable request/approval actions in the UI.

The shared proto/common-grpc repositories require proto generation and consumer lint, not application builds or tests. Petty Cash verification follows its own repository requirements. Production migrations, permission provisioning, publishing and deployment are separate from the local code changes.

## Diagnosing a lookup 503

The public 503 does not expose upstream errors. Petty Cash API logs failures with event `staff_directory_lookup_failed`, RPC name, stage, reason, gRPC code (when available), transport mode and invalid response field names. Email, staff values, tokens and raw upstream errors are excluded. In Cloud Run, open the Petty Cash API service logs, search for `staff_directory_lookup_failed`, then retry the lookup and inspect the new entry.

| Reason | Check |
| --- | --- |
| `CLIENT_RPC_MISSING` | The Petty Cash API's installed `@pension/proto` must contain `FindStaffByEmail`; publish and consume the updated contract. |
| `UNIMPLEMENTED` (12) | The target common-grpc deployment must expose `common.CommonService/FindStaffByEmail`, with the new name and regenerated proto. Also verify the target is the intended gRPC service. |
| `UNAVAILABLE` (14) | Check `COMMON_GRPC_URL`, DNS, port, TLS and common-grpc readiness. |
| `UNAUTHENTICATED` (16) / `PERMISSION_DENIED` (7) | Check Google ID-token audience and the Petty Cash runtime service account's Cloud Run invoker access. |
| `TIMEOUT` / `DEADLINE_EXCEEDED` (4) | Lookup exceeded its deadline; inspect common-grpc and database latency/connectivity. |
| `CLIENT_INITIALIZATION_FAILED` | Check the installed proto/service definition. Registration and Google credential initialization failures appear in API startup logs. |
| Startup error: `COMMON_GRPC_URL is required` | Configure the directory target using the working Employment API convention before starting the HTTP API. |
| `INVALID_RESPONSE` / `EMAIL_MISMATCH` | Check the logged field names and the common-grpc response contract. |
| `INTERNAL` (13) / `UNKNOWN` (2) | Inspect common-grpc logs at the same timestamp for the server-side failure. |

An active employee not being found returns 404; an ambiguous email returns 409. These expected outcomes do not produce an infrastructure failure log. The RPC is independent of requester/approver assignment eligibility.
