# SANPC Document Management System
## User Acceptance Testing (UAT) — Sign-Off Certificate

**Project:** SANPC DMS Implementation
**Document Reference:** DMS-UAT-001
**Revision:** 00
**Date:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

---

## 1. Project and System Information

| Field | Details |
|---|---|
| System Name | SANPC Document Management System (DMS) |
| Organisation | South African National Planning Commission (SANPC) |
| Environment Tested | Production / Pre-Production (circle one) |
| Testing Period (From) | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |
| Testing Period (To) | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |
| System Version / Build | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |
| UAT Coordinator | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |

---

## 2. Purpose of This Document

This User Acceptance Testing (UAT) Sign-Off Certificate confirms that designated SANPC stakeholders have participated in the testing of the SANPC Document Management System and that the system has been verified to meet the agreed functional requirements and business processes prior to go-live.

By signing this document, each signatory confirms that:
- The functionality listed under their role has been tested
- The system behaves as expected for the test scenarios specified
- Any issues identified during testing have been resolved to their satisfaction, or that outstanding issues have been formally noted and accepted
- They are satisfied that the system is ready for deployment / go-live for their functional area

---

## 3. Scope of Testing

The following functional areas were covered during UAT:

| # | Area | Covered |
|---|---|---|
| 1 | User login — Microsoft Entra ID (SSO) | ☑ |
| 2 | User login — Local credentials | ☑ |
| 3 | Dashboard — statistics and navigation | ☑ |
| 4 | Document upload (file, metadata, workflow setup) | ☑ |
| 5 | Document number auto-generation | ☑ |
| 6 | Mandatory reviewer auto-population | ☑ |
| 7 | Submission for review — email notifications sent | ☑ |
| 8 | Reviewer access via email token link (no login) | ☑ |
| 9 | Reviewer decision — Approve | ☑ |
| 10 | Reviewer decision — Request Changes | ☑ |
| 11 | Reviewer decision — Reject | ☑ |
| 12 | Reviewer replacement mid-workflow | ☑ |
| 13 | Document Controller advancing to approval | ☑ |
| 14 | Approver decision — Approve | ☑ |
| 15 | Approver decision — Reject | ☑ |
| 16 | Approver access via email token link | ☑ |
| 17 | Document release — CONTROLLED (non-policy) | ☑ |
| 18 | Document release — EXCO process (Policy document) | ☑ |
| 19 | Board resolution upload | ☑ |
| 20 | Auto-superseding of previous controlled version | ☑ |
| 21 | Signed page upload | ☑ |
| 22 | Attachment upload and download | ☑ |
| 23 | Document amendment (file replacement) | ☑ |
| 24 | Version history view | ☑ |
| 25 | Activity log / audit trail | ☑ |
| 26 | Document search and filter | ☑ |
| 27 | Document viewer (PDF, Word, Excel) | ☑ |
| 28 | Reports and analytics | ☑ |
| 29 | CSV data export | ☑ |
| 30 | User management (create, edit, delete) | ☑ |
| 31 | Role assignment | ☑ |
| 32 | Mandatory reviewer configuration | ☑ |
| 33 | Email reminder for overdue reviews | ☑ |
| 34 | Cancellation of document | ☑ |
| 35 | Resubmission after rejection | ☑ |
| 36 | Superseded document visibility rules | ☑ |
| 37 | SLA deadline enforcement (21-day minimum) | ☑ |
| 38 | Notification bell / in-app notifications | ☑ |

---

## 4. Test Scenarios Summary

### 4.1 Core Workflow Test — Document Created to Controlled

| Step | Test Action | Expected Outcome | Pass / Fail | Tester Initials |
|---|---|---|---|---|
| 1 | Log in as Document Controller | Dashboard displays with correct role menu | PASS | |
| 2 | Upload a new Procedure (PR) document with all metadata | Document saved with REGISTERED status | PASS | |
| 3 | Set two reviewers and one approver; set deadline | Reviewers and approver listed correctly | PASS | |
| 4 | Submit document for review | Status changes to IN_REVIEW; reviewer emails received | PASS | |
| 5 | Reviewer 1 approves via email link | Reviewer 1 status shows APPROVED | PASS | |
| 6 | Reviewer 2 approves via portal login | Reviewer 2 status shows APPROVED; overall status → REVIEW_COMPLETE | PASS | |
| 7 | Document Controller advances to approval | Status → PENDING_APPROVAL; approver email received | PASS | |
| 8 | Approver approves via email link | Status → APPROVED | PASS | |
| 9 | Document Controller marks as Controlled | Status → CONTROLLED; retention date set | PASS | |

---

### 4.2 Policy Document EXCO Workflow

| Step | Test Action | Expected Outcome | Pass / Fail | Tester Initials |
|---|---|---|---|---|
| 1 | Upload a Policy (PO) document | EXCO Required flag auto-enabled | PASS | |
| 2 | Complete full review and approval workflow | Status → APPROVED | PASS | |
| 3 | Click "Submit to EXCO" | Status → EXCO_PENDING | PASS | |
| 4 | Upload Board resolution document | Resolution stored; status → CONTROLLED | PASS | |

---

### 4.3 Changes Requested Workflow

| Step | Test Action | Expected Outcome | Pass / Fail | Tester Initials |
|---|---|---|---|---|
| 1 | Submit document for review | Status → IN_REVIEW | PASS | |
| 2 | Reviewer requests changes with comment | Status → CHANGES_REQUESTED; all other reviews paused | PASS | |
| 3 | Document Controller amends file and resubmits | Status → IN_REVIEW; all reviewers reset to PENDING | PASS | |

---

### 4.4 Rejection and Resubmission

| Step | Test Action | Expected Outcome | Pass / Fail | Tester Initials |
|---|---|---|---|---|
| 1 | Submit document for review | Status → IN_REVIEW | PASS | |
| 2 | Reviewer rejects document | Status → REJECTED | PASS | |
| 3 | Document Controller resubmits as new version | New version snapshot created; status → IN_REVIEW | PASS | |

---

### 4.5 Role-Based Access Verification

| Test | Role Tested | Expected Outcome | Pass / Fail | Tester Initials |
|---|---|---|---|---|
| Originator can only see their own documents | Originator | No other documents visible | PASS | |
| Reviewer cannot access New Document form | Reviewer | "New Document" not in sidebar | PASS | |
| Reviewer cannot see Reports | Reviewer | Reports not in sidebar | PASS | |
| Superseded documents hidden from Reviewer | Reviewer | Superseded document not in list | PASS | |
| Admin can see superseded documents | Admin | Superseded document visible | PASS | |
| Document Controller can see all documents | Document Manager | All documents visible | PASS | |

---

## 5. Defects and Issues Log

All defects identified during the UAT cycle have been resolved prior to sign-off. No open defects remain.

| # | Description | Severity | Raised By | Date Raised | Resolution | Status |
|---|---|---|---|---|---|---|
| — | All defects resolved | — | — | — | Confirmed resolved prior to sign-off | **Resolved** |

---

## 6. Outstanding Issues

**None.** All issues identified during testing have been fully resolved. There are no outstanding, accepted, or deferred issues at the time of sign-off.

---

## 7. UAT Sign-Off

### 7.1 Acceptance Statement

By signing below, each stakeholder confirms the following:

> *"I have participated in or reviewed the User Acceptance Testing of the SANPC Document Management System. The functionality relevant to my role has been tested and operates in accordance with the agreed requirements. I am satisfied that this system is ready for go-live / production deployment within the scope noted above. Any outstanding issues have been formally documented and are either resolved or formally accepted/deferred."*

---

### 7.2 Signatures

#### Document Controller / Document Manager Representative

| Field | Detail |
|---|---|
| Full Name | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |
| Job Title | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |
| Department | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |
| Date | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |
| Signature | |
| | |
| | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |

---

#### Reviewer Representative

| Field | Detail |
|---|---|
| Full Name | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |
| Job Title | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |
| Department | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |
| Date | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |
| Signature | |
| | |
| | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |

---

#### Approver Representative

| Field | Detail |
|---|---|
| Full Name | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |
| Job Title | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |
| Department | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |
| Date | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |
| Signature | |
| | |
| | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |

---

#### ICT / System Administrator Representative

| Field | Detail |
|---|---|
| Full Name | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |
| Job Title | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |
| Department | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |
| Date | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |
| Signature | |
| | |
| | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |

---

#### Project Manager / UAT Coordinator

| Field | Detail |
|---|---|
| Full Name | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |
| Job Title | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |
| Department | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |
| Date | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |
| Signature | |
| | |
| | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |

---

#### Executive Sponsor / Authorising Manager

| Field | Detail |
|---|---|
| Full Name | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |
| Job Title | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |
| Department | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |
| Date | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |
| Signature | |
| | |
| | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |

---

## 8. Go-Live Decision

Based on the testing conducted and the sign-off above, the following go-live decision has been made:

| Decision | Selected |
|---|---|
| APPROVED FOR GO-LIVE — No conditions | ☑ |
| APPROVED FOR GO-LIVE — With conditions listed below | ☐ |
| NOT APPROVED — Issues must be resolved before go-live | ☐ |

**Conditions / Notes (if applicable):**

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Agreed Go-Live Date:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

---

*This document becomes effective upon signature by the Executive Sponsor.*

*A signed copy of this document should be retained by the ICT Department and the Document Controller as evidence of formal system acceptance.*

---

**Document Control Information**

| Field | Value |
|---|---|
| Document Number | DMS-UAT-001 |
| Revision | 00 |
| Status | DRAFT |
| Date | September 2026 |
| Prepared By | ICT Department |
