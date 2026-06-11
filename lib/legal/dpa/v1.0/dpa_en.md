# Data Processing Agreement — The Tafel

**Version 1.0 — effective from 1 June 2026**

> **DRAFT — requires Dutch corporate-legal review before public launch.**

This Data Processing Agreement applies to every processing of personal data by **Ontwikkeling Tech Services**, registered with the Dutch Chamber of Commerce (KVK) under number `[OTS_KVK]`, operating under the registered trade name **"The Tafel"** (hereafter: "The Tafel" or "processor"), on behalf of a Restaurant (hereafter: "Restaurant" or "controller"). This Agreement complies with Article 28(3) of Regulation (EU) 2016/679 (GDPR / AVG).

## 1. Roles

The Restaurant acts as **data controller**. The Tafel acts as **data processor**, on the Restaurant's documented instructions as set out in the Agreement, this Data Processing Agreement, and the platform's standard configuration.

## 2. Subject matter, nature, and duration

The Tafel processes personal data only to provide the Services. Purposes are: taking and managing reservations; processing takeaway and QR orders; sending booking confirmations, reminders, and no-show notices; supporting the Restaurant's day-to-day operations; producing operational analytics for the Restaurant's dashboard; and, in aggregated and anonymised form, improving the Services.

Processing continues for the duration of the Agreement and ends in accordance with clause 9.

## 3. Categories of personal data

The Tafel processes the following categories on behalf of the Restaurant:

- **diner contact details:** name, email address, phone number;
- **booking details:** date, time, party size, table preference, special requests, dietary notes;
- **order details:** items ordered, allergens declared, order timestamps, table session metadata;
- **communication metadata:** delivery status of confirmations, reminders, and notices;
- **limited payment metadata** returned by Mollie (such as last four digits of a card, for display only). The Tafel does not store full card numbers, CVV codes, or IBANs.

No special categories of personal data within the meaning of Article 9 GDPR are intentionally processed. The Restaurant undertakes not to submit such data through the platform's free-text fields.

## 4. Categories of data subjects

The data subjects are the Restaurant's diners (including walk-ins where recorded) and the Restaurant's own staff who are given access to the platform.

## 5. The Tafel's obligations (as processor)

5.1 **Documented instructions.** The Tafel processes personal data only on documented instructions from the Restaurant. If The Tafel is required by EU or Dutch law to process personal data otherwise, it will inform the Restaurant before processing, unless that law prohibits this on important grounds of public interest.

5.2 **Confidentiality.** All persons authorised by The Tafel to process personal data are bound by appropriate confidentiality obligations.

5.3 **Security measures (Article 32 GDPR).** The Tafel implements appropriate technical and organisational measures to ensure a level of security appropriate to the risk, including:

- encryption of data in transit using TLS 1.2 or higher;
- encryption of data at rest using AES-256 by the database provider;
- row-level access controls in the database;
- secret management via the hosting platform's environment-variable system, never in source code;
- regular automated backups with a maximum 90-day rotation;
- access logging and audit trails;
- principle of least privilege for staff and contractors;
- annual review of security measures and prompt patching of known vulnerabilities.

5.4 **Sub-processors.** The Tafel uses the sub-processors listed in the annex. By signing the Agreement, the Restaurant grants The Tafel general written authorisation under Article 28(2) GDPR to engage these sub-processors. The Tafel will give the Restaurant at least 30 days' advance written notice of any intended addition or replacement. The Restaurant may object on reasonable grounds within that period. If the Parties cannot reach agreement, the Restaurant may terminate the Agreement with effect from the date the sub-processor change would take effect, without further liability. The Tafel imposes on each sub-processor data-protection obligations no less protective than those in this Data Processing Agreement.

5.5 **Assistance with data-subject rights.** Taking into account the nature of the processing, The Tafel will assist the Restaurant by appropriate technical and organisational measures, insofar as this is possible, in fulfilling the Restaurant's obligation to respond to requests from data subjects under Articles 12 to 23 GDPR.

5.6 **Assistance with security and breach obligations.** The Tafel will assist the Restaurant in complying with its obligations under Articles 32 to 36 GDPR, taking into account the nature of processing and the information available to The Tafel.

5.7 **Personal data breach notification.** The Tafel will notify the Restaurant without undue delay, and in any event **within 48 hours** of becoming aware of a personal data breach affecting personal data processed on behalf of the Restaurant. The notification will include, to the extent then known: the nature of the breach; the categories and approximate number of data subjects and records affected; the likely consequences; and the measures taken or proposed.

5.8 **Compliance documentation.** Once per 12-month period, on the Restaurant's written request, The Tafel will provide its then-current security and compliance documentation, including a summary of the technical and organisational measures listed in clause 5.3, the sub-processor list, and any third-party security certifications then in effect. This documentation serves in lieu of an on-site audit. If the Restaurant has a documented legal or regulatory obligation that specifically requires an on-site audit and demonstrates that the documentation provided is insufficient, the Parties will agree in good faith on the scope, timing, and reasonable costs of such an audit.

5.9 **Information rights.** The Tafel makes available to the Restaurant all information necessary to demonstrate compliance with this Data Processing Agreement.

## 6. International transfers

Some sub-processors listed in the annex may process personal data outside the European Economic Area. For each such transfer, The Tafel relies on an appropriate transfer mechanism under Chapter V GDPR: either an adequacy decision (including the EU-US Data Privacy Framework where applicable) or the Standard Contractual Clauses adopted under Commission Implementing Decision (EU) 2021/914.

## 7. Deletion or return on termination

Within 30 days after termination of the Agreement, The Tafel will, at the Restaurant's written choice expressed before the termination date, either delete or return all personal data processed on the Restaurant's behalf. Backups containing personal data are deleted in accordance with the standard backup rotation cycle and in any event within 90 days. The Tafel may retain personal data to the extent required by Dutch tax or other mandatory law (such as the 7-year retention obligation for commercial records); retained data remains subject to this Data Processing Agreement.

## 8. Conflict

In the event of conflict between this Data Processing Agreement and any other provision of the Agreement, this Data Processing Agreement prevails on matters concerning the processing of personal data.

## 9. Term

This Data Processing Agreement takes effect on the Effective Date of the Agreement and remains in force for as long as The Tafel processes personal data on behalf of the Restaurant. Clauses 5.7, 5.9, 6, and 7 survive termination to the extent necessary to comply with their terms.

---

## Annex — Sub-processors

The Tafel engages the following sub-processors to deliver the Services. The Tafel will give 30 days' advance written notice of any addition or replacement.

| # | Sub-processor | Role | Processing location | Transfer mechanism |
|---|---|---|---|---|
| 1 | Supabase Inc. | Database, authentication, file storage | EU (Frankfurt region) | N/A — within the EEA |
| 2 | Mollie B.V. | Payment processing, mandate management | Netherlands | N/A — within the EEA |
| 3 | Vercel Inc. | Application hosting, edge delivery | EU primary; global edge | EU Standard Contractual Clauses (2021/914) + EU-US Data Privacy Framework |
| 4 | Resend, Inc. | Transactional email delivery | United States | EU Standard Contractual Clauses (2021/914) + EU-US Data Privacy Framework |
| 5 | Upstash, Inc. | Caching and rate-limiting | EU (Frankfurt region) | EU Standard Contractual Clauses (2021/914) for the US parent entity |
| 6 | Meta Platforms Ireland Limited | WhatsApp Business Cloud API for booking confirmations and reminders | Ireland (EU) with US affiliate | EU Standard Contractual Clauses (2021/914) + EU-US Data Privacy Framework |
