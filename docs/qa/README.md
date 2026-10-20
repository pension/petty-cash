# Petty Cash visual verification

Captured on 19 October 2026 against the completed ui-lab Petty Cash screens. Each screen has a local implementation capture and a `reference` capture at desktop (1280×900) and mobile (390×844) sizes. Role-dependent actions and synthetic financial data intentionally differ.

| Filename prefix | Route |
| --- | --- |
| requests | `/` |
| approvals | `/approvals` |
| finance | `/finance` |
| history | `/requests` |
| request | `/requests/:id` |
| reconciliation | `/reconciliation` |
| fund | `/fund` |

The request detail captures show the completed synthetic workflow: MVR 100 issued, MVR 60.25 spent and MVR 39.75 returned. Receipt persistence was checked after reload. Create, preparation, receipt, settlement and finalization modals were inspected during that workflow, but are not separately captured here.

These captures verify the imported page composition and responsive layout. They do not replace staging checks with actual Bifrost roles or inspection of downloaded PDF files. See [the release checklist](../IMPLEMENTATION.md).

`refactor-closed-request.jpg` records the subsequent feature-module refactor browser check at the default 1280×720 viewport. Request PC-2026-0128 completed the full GS–Finance workflow using synthetic Bifrost identities and unprefixed API routes, with MVR 10 issued and fully spent. The capture was taken after reloading the closed request.

Bulk receipt modal: `bulk-receipts-desktop.png` (1440×1000) and `bulk-receipts-mobile.png` (390×844), captured 2026-10-20 using the actual Vue component/UI-kit and synthetic extraction results. Checked progress/review, desktop header visibility, mobile scrolling, editing, row removal and confirmation. No horizontal viewport overflow. The new modal has no ui-lab bulk reference; it follows the incumbent UI-kit modal/table/form composition.

Compact bulk picker and embedded attachment previews (2026-10-20): `bulk-picker-mobile.png`, `receipt-pdf-desktop.png`, `receipt-image-mobile.png`. Checked the actual components with synthetic files at 1440×1000 and 390×844. Browser checks exercised file selection, drag-and-drop, compact-to-review modal width, and protected-blob-style PDF/image embedding. Native PDF captures wait for both the drawer transition and viewer rendering to finish. Actual request details retain their existing metadata cards above the preview.
