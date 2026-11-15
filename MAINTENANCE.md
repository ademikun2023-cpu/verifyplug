# VerifyPlug maintenance

Static HTML/CSS/ES-module app; existing Firebase project, Cloudinary uploads, and Paystack integration are retained. `bootstrap.js` loads `app.js` for signed-in workspaces and `profile.js` for public vendor pages. `ui.js` handles auth-screen presentation and modal accessibility.

## Regression checks

Run `node --test tests/flows.test.cjs`. Tests execute the real app logic with an isolated fake DOM and Firebase adapter; they never contact production. Coverage includes returning/new vendors, slow and failed reads, sign-out during lookup, role routing, restricted accounts, month rollover, review input validation, phone formats, safe rendering, duplicate taps, and profile links.

Browser QA uses copies of the actual pages with a separate, local-only Firebase fixture. No fixture files are included in this repository or deployment. Phone-width checks at 320px and 390px supplement desktop review. These checks do not establish that production Firestore security rules or authenticated writes are correct.

## Known backend work (not resolved by this UI release)

- Paystack's existing browser callback sets `vendors.verified`. Move payment verification and membership grants to an authenticated server endpoint/webhook using Paystack's secret key and Firebase server credentials. Never put those credentials in browser code.
- Firestore rules and server code are absent from this repository and were not accessible in this session. Role routing and owner checks added here are UX safeguards, not substitutes for database authorization. Review deployed rules before treating admin operations, ownership, purchase-code limits, reviews, and report-driven trust changes as secure.
- Purchase-code generation and report score updates remain client-side read/write sequences. The action lock prevents double taps in one tab; cross-device concurrency and one-time code consumption need server transactions and authorization.
- No live customer account, paid transaction, vendor edit, report, or deletion was used for QA. Confirm an existing vendor and a new vendor with authorized production test accounts after release.

The paid upgrade keeps its existing ₦5,000 amount; this refresh does not migrate payment providers or change membership terms.
