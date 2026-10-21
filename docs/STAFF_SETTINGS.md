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
3. Configure Petty Cash `COMMON_GRPC_URL=host:port`. Development uses insecure gRPC; other environments use TLS and Google service-account ID tokens. `COMMON_GRPC_AUDIENCE` optionally overrides the default `https://host` audience. The Petty Cash runtime service account needs permission to invoke the common-grpc service. Missing configuration disables lookup with a clear error, without breaking unrelated API startup.
4. Review and deploy the additive `20261021120000_staff_assignments` migration to the intended Petty Cash database. It creates new tables only and seeds the two lock rows, not any staff. Do not reset a database or copy ui-lab mock employees.
5. Run the permission provisioning SQL in Bifrost to grant the four Settings permissions to the Finance role, assign that role to the appropriate users, refresh sessions, and add at least one requester and approver. Deploy the frontend restrictions with this setup step coordinated: empty lists disable request/approval actions in the UI.

The shared proto/common-grpc repositories require proto generation and consumer lint, not application builds or tests. Petty Cash verification follows its own repository requirements. Production migrations, permission provisioning, publishing and deployment are separate from the local code changes.
