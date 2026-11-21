# GDP03 - Personal Data Breach Handling

This procedure applies to personal data processed by LaPrizza in the project scenario. LaPrizza assesses the risk, decides whether to notify and ensures that notifications are sent. 

## What constitutes a breach

A personal data breach occurs when a security failure leads to accidental or unlawful destruction, loss, alteration, unauthorised disclosure of, or access to, personal data being processed by the organisation (Article 4(12) of the [GDPR][gdpr]). A breach can affect confidentiality, integrity, availability or several of these at once.

At LaPrizza, improper disclosure of a customer record affects confidentiality, an unauthorised change to recorded intolerances affects integrity, and loss of access to customer data after a failure affects availability. A denied access attempt on its own is a signal to investigate. Classifying it as a breach requires determining whether personal data were compromised.

## Assessment and initial response

1. **Escalate and record.** Anyone who detects an incident alerts LaPrizza's designated internal contact immediately. Record the detection time and, separately, the time when LaPrizza had a reasonable degree of certainty that the incident compromised personal data. The Article 33 deadline runs from that point of awareness. A processor that becomes aware of a breach must alert LaPrizza without undue delay (Article 33(2)).
2. **Contain the incident and preserve evidence.** The technical team restricts the affected access, preserves relevant records with limited access and identifies the affected data and people. If data must be restored, follow the backup procedure and verify integrity before resuming service.
3. **Assess risk to individuals.** Consider the likelihood and severity of the consequences, the nature and sensitivity of the data, ease of identifying individuals, the number of people affected, who received the data and the safeguards actually in place. Identify concrete consequences such as fraud, discrimination or exposure of health information. Reassess as new facts become available. [EDPB Guidelines 9/2022][edpb]
4. **Decide, communicate and follow up.** LaPrizza applies the rules below, records the rationale and follows the incident through to completion of corrective measures. The designated contact coordinates the response and provides further information. Involve the data protection officer in the assessment where one has been appointed.

## Recipients and deadlines

| Breach assessment | Supervisory authority | Affected individuals |
|---|---|---|
| Unlikely to result in a risk to rights and freedoms | No notification. Record the rationale. | No communication. |
| Likely to result in a risk, with no indication of high risk | Notify. | No communication while this assessment holds. |
| Likely to result in a high risk | Notify. | Communicate unless an Article 34(3) condition applies. |

- **Supervisory authority (Article 33).** LaPrizza must notify the **CNPD** using the form on its [data breach page][cnpd] without undue delay and, where feasible, within **72 hours of becoming aware**. The period includes weekends and public holidays. If information is incomplete, submit what is known and provide the rest in phases without undue delay. If notification occurs after 72 hours, include the reasons for the delay.
- **Affected individuals (Article 34).** In a high-risk case, communicate **without undue delay**, in clear and plain language, via a direct, secure channel where possible. The 72-hour period applies to notifying the authority. Communication to affected individuals proceeds in parallel as soon as possible.

Article 34(3) allows direct communication to be omitted if safeguards already applied to the affected data render it unintelligible to unauthorised persons, for example encryption with an uncompromised key, or if later measures ensure the high risk is no longer likely to materialise. If direct communication would involve disproportionate effort, make a public communication or take an equally effective measure. The CNPD can require communication to affected individuals under Article 34(4). [GDPR Articles 33 and 34][gdpr]

## Minimum content

| To the CNPD (Article 33(3)) | To affected individuals (Article 34(2)) |
|---|---|
| Nature of the breach and, where possible, the categories and approximate numbers of affected individuals and of personal data records concerned. | What happened and which of the person's data were affected, in clear and plain language. |
| Name and contact details of the data protection officer or another contact point. | Name and contact details of the data protection officer or another contact point. |
| Likely consequences for individuals. | Likely consequences for the person. |
| Measures taken or proposed to address the breach and mitigate adverse effects. | Measures taken or proposed to address the breach and mitigate adverse effects. Include practical steps the person can take where helpful. |

Record **every** breach, including those that do not require notification (Article 33(5)). Keep the facts, timeline, effects, risk assessment and revisions, corrective measures and decision for each recipient in a restricted-access register. Where a notification or communication is sent, retain its content, dispatch time and available evidence of dispatch.

## Example of customer record disclosure

In this fictional example, an external recipient receives a file with 120 customer records by mistake. The file contains names, phone numbers, email addresses and food intolerances. The recipient confirms opening the file, but the team cannot verify that copies were deleted.

| Illustrative time (Lisbon time, UTC+0) | Expected response |
|---|---|
| Friday, 09:30 | The team receives the alert, records the detection time and investigates. |
| Friday, 10:00 | LaPrizza confirms that a file containing personal data was opened. It records awareness of the breach, asks for copies to be deleted and preserves evidence. |
| Friday, 12:00 | The disclosure of health information linked to identifiable people, with the potential for discrimination and fraudulent contact, supports a high-risk assessment. LaPrizza notifies the CNPD and starts contacting affected individuals directly. |
| Monday, 10:00 | 72 hours have elapsed since awareness. The initial notification has already been sent. Submit any outstanding information without undue delay as it becomes available. |

The CNPD notification includes approximately 120 affected individuals and 120 customer records, the data involved, likely consequences, containment measures and the designated contact. The message to customers explains the disclosure of contact and intolerance information, the likely consequences, the request to delete copies and how to contact LaPrizza. It advises them to be cautious about unexpected messages or calls claiming to come from the restaurant.

[gdpr]: https://eur-lex.europa.eu/eli/reg/2016/679/en
[cnpd]: https://www.cnpd.pt/organizacoes/outras-obrigacoes/violacao-de-dados-ou-data-breach/
[edpb]: https://www.edpb.europa.eu/documents/guideline/guidelines-92022-on-personal-data-breach-notification-under-gdpr_en
