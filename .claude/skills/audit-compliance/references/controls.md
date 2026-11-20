# The 15 legal and privacy launch controls

Each control states what PASS means, how to check it, and when it is legitimately N/A. **PASS means "exists, matches the system, and the process runs"**, never "legally sufficient". Legal sufficiency is `LEGAL-REVIEW` unless a lawyer's review is recorded.

The most valuable check in almost every control is **consistency**: compare the document against the data map from recon. A policy that promises something the code doesn't do, or omits something the code does, is a FAIL.

## A. Published documents

### 1. Privacy policy
- **PASS:** published, reachable from every page that collects data (footer, forms, signup). It names the controller and contact, the data collected, purposes, legal basis, processors, international transfers, retention, rights and how to exercise them, cookies, and the last-updated date. It is available in every language the product uses.
- **Check:** compare each data-map item against the text (fields, processors, regions, retention, cookies). Look for a test or process that keeps them in sync.
- **N/A:** never, if any personal data is collected (a contact form counts).

### 2. Terms & conditions
- **PASS:** published terms covering the service, acceptable use, accounts, liability limits, IP, governing law and jurisdiction, changes, and termination. Users accept them where an account or purchase exists (with the accepted version recorded).
- **Check:** terms page, acceptance checkbox and its storage, version or date.
- **N/A:** purely informational site with no accounts, purchases, or user content. Even then, a site legal notice is good practice: report as low severity.

### 10. Third-party disclosure
- **PASS:** every processor and third party that receives personal data (hosting, email, CRM, analytics, payments, AI/LLM APIs, embedded widgets, fonts/CDNs) is listed with its purpose and country. International transfers are disclosed with their basis.
- **Check:** compare the data map and code (SDKs, `fetch` destinations, script tags, IaC regions, env vars for third-party APIs) against the list in the policy.
- **N/A:** never if any third party processes data.

## B. Lawful basis & consent

### 3. Applicable data-protection law (GDPR / Ley 18.331 / others)
- **PASS:** the applicable regimes are identified and recorded. Their core duties are mapped to the product. For Uruguay, the database is registered with the URCDP (Ley 18.331). For GDPR, there is a record of processing and an EU representative if required.
- **Check:** the decision record, registration evidence (propose the lookup to the user), and the target market (languages, currencies, EU marketing).
- **N/A:** never. At least the home jurisdiction applies.

### 4. Cookie consent
- **PASS:** non-essential cookies, local storage, pixels, and analytics load **only after** opt-in. Rejecting is as easy as accepting, the choice can be changed later, and the choice is remembered. Strictly necessary items are documented.
- **Check:** the code paths that load analytics or pixels (consent gate before load?), the storage keys, the banner component, and its tests. A live check with the user's OK: load the site with no consent and list the requests and cookies.
- **N/A:** no cookies or storage beyond strictly necessary ones. Still documented in the policy.

### 5. Legal basis
- **PASS:** each processing purpose has a stated basis (consent, contract, legal obligation, legitimate interest). Where the basis is consent, it is freely given, specific, recorded (who, when, which policy version), and withdrawable.
- **Check:** form checkboxes (not pre-ticked), the stored consent timestamp and version, and the purposes in the policy against the real uses.
- **N/A:** never if personal data is processed.

### 6. Marketing consent
- **PASS:** marketing email/SMS/WhatsApp is sent only with a separate opt-in (not bundled with the terms or a contact form), and every message has a working unsubscribe that is honored.
- **Check:** signup and checkout checkboxes, newsletter tooling, unsubscribe handling, and whether contact-form leads are added to marketing lists.
- **N/A:** no marketing communications at all, and the policy says so.

## C. Data lifecycle

### 7. Data deletion
- **PASS:** a documented, working way to fulfill access, rectification, and deletion requests within the legal period, covering **every** store in the data map (DB, CRM, email, backups, logs, processors). Account deletion is self-service when accounts exist.
- **Check:** the rights-request procedure, the delete endpoints or scripts, coverage of each store, and backup handling.
- **N/A:** never if personal data is stored.

### 8. Data retention
- **PASS:** a retention period per data category, stated in the policy and **enforced** (TTL, lifecycle rules, scheduled job, or a dated, owned manual review with evidence that it runs).
- **Check:** TTL and lifecycle settings in IaC, cron jobs, CRM cleanup procedures and their last execution, and log retention.
- **N/A:** nothing persisted.

## D. Vendors & contracts

### 9. Data processing agreements
- **PASS:** every processor in the data map has a DPA or equivalent terms in force (often accepted click-through in the vendor's terms or admin console), with transfer mechanisms where needed. The record states where each DPA lives. For client projects: the client–Ultria contract defines who is controller and who is processor.
- **Check:** a DPA register in docs and the contract templates. Vendor console acceptance cannot be seen from code: propose the check for the user.
- **N/A:** no processors.

### 13. Intellectual property
- **PASS:** ownership of code, designs, content, and data is defined in the contract (who owns the deliverables, when ownership transfers, what Ultria may reuse, portfolio rights). Third-party assets (images, fonts, icons, AI-generated content) have usable licences, and the product doesn't infringe obvious trademarks.
- **Check:** contract and proposal templates (docs/business 03 and 05), asset sources and licences, font licences, and AI-content policy.
- **N/A:** never for a delivered project.

### 15. Payments & subscriptions
- **PASS:** card data is handled only by a certified provider (no PAN/CVV stored or logged: PCI scope minimized). Prices, taxes, renewal, cancellation, refunds, and trial terms are clear before purchase. Cancellation is as easy as signup. Consumer law applies (Uruguay Ley 17.250 for consumers). Invoices or receipts are issued as required.
- **Check:** checkout flow, provider integration (hosted fields or checkout), webhook handling, and terms text.
- **N/A:** no payments.

## E. Security & incidents

### 11. Data security
- **PASS:** a security audit by `skills/audit-project` exists for this target, is no older than the last significant change, and its gate is READY or its blocking items are ACCEPTED. The policy's security claims don't promise more than what is implemented.
- **Check:** the latest `docs/audits/security-audit-*.md` and its verdict. If there is none, report `VERIFY` and recommend running the security audit. Do not repeat it here.
- **N/A:** never.

### 12. Data breach procedure
- **PASS:** a written procedure covering detection, containment, assessment, an internal owner, notification to the authority and affected people within the legal deadlines (verify the current requirement for each jurisdiction: Uruguay URCDP under Decreto 64/020, GDPR 72 h), client notification duties under contract, and an incident log.
- **Check:** the operations manual, incident templates, contracts, and monitoring and alerting that would detect a breach.
- **N/A:** never if personal data is stored.

## F. Open-source licences

### 14. Open-source licences
- **PASS:** an inventory of dependency licences exists for shipped code. Copyleft (GPL, AGPL, LGPL, SSPL) and unknown or no-licence packages are flagged and reviewed against how the product is distributed. Required attributions or notices are included. Ideally CI fails on licences outside an allow-list.
- **Check:** `npx license-checker-rseidelsohn --production --summary` (or `pip-licenses`, `go-licenses`). Include vendored code, fonts, and copied snippets. For client deliveries, the licence summary goes in the handover.
- **N/A:** no third-party code.
