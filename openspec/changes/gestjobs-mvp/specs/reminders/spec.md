# Reminders Specification

## Purpose
Surface 15-day follow-up reminders for open applications, computed from the application date or the latest status change, with in-app and email delivery.

## Requirements

### Requirement: Reminder Scheduling
For every application in a non-terminal status, the system MUST compute next_reminder_at as 15 days after the most recent status change timestamp. If no status change has occurred, the system MUST use the application_date as the base. The computation MUST be idempotent and rerun whenever a status change occurs.

#### Scenario: Initial schedule from application date
- GIVEN an application with application_date on 2026-08-01 and no status changes
- WHEN the reminder job runs
- THEN next_reminder_at is set to 2026-08-16
#### Scenario: Reschedule on status change
- GIVEN an application with a status change on 2026-08-10
- WHEN the reminder job evaluates it
- THEN next_reminder_at recomputes to 2026-08-25
#### Scenario: No reschedule on note addition
- GIVEN an application with next_reminder_at set from a status change on 2026-08-10
- WHEN the user adds a note without changing status
- THEN next_reminder_at remains 2026-08-25

### Requirement: Terminal Status Suppression
The system MUST NOT schedule or retain reminders for applications in terminal statuses (Rejected, Withdrawn, Hired).

#### Scenario: Terminal application
- GIVEN an application status "Rejected"
- WHEN the reminder job evaluates it
- THEN no reminder is created or retained
#### Scenario: Re-opened application reschedules
- GIVEN an application moved from "Hired" back to an open status
- WHEN the status change occurs
- THEN a new reminder is scheduled 15 days from that change

### Requirement: In-App Pending Surface
The system MUST display pending reminders in a dedicated dashboard section and per-application banner. Dismissed reminders MUST NOT appear.

#### Scenario: Pending reminder visible
- GIVEN an application with next_reminder_at in the past
- WHEN the user opens the dashboard
- THEN the application appears in the pending reminders list
#### Scenario: Dismissed reminder hidden
- GIVEN a pending reminder that the user dismissed
- WHEN the dashboard loads
- THEN the reminder is excluded from the pending list

### Requirement: Email Dispatch
The system SHOULD send an email for each due reminder. Email delivery is secondary to the in-app surface.

#### Scenario: Email sent
- GIVEN a due reminder
- WHEN the scheduled dispatch runs
- THEN an email is sent to the user with application details
#### Scenario: Email failure logged
- GIVEN a due reminder and a failing email provider
- WHEN dispatch fails
- THEN the failure is logged and the in-app surface remains unaffected

## Non-Goals
- User-configurable reminder cadence
- Push notifications or SMS
- Calendar integration
- Snoozing reminders beyond dismissal

## Acceptance Criteria
- [ ] Reminder is computed exactly 15 days from application date or latest status change
- [ ] Terminal statuses suppress reminders; reopening restores them
- [ ] Overdue reminders appear in a dedicated in-app section
- [ ] Email dispatch runs for due reminders with failure logging
