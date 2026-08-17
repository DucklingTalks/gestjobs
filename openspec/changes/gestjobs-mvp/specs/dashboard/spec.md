# Dashboard Specification

## Purpose
Provide a lightweight overview of application counts by status and a list of pending reminders.

## Requirements

### Requirement: Status Counters
The system MUST display the total count of applications grouped by current status.

#### Scenario: View counters
- GIVEN the user has 3 applications in "Applied" and 1 in "Interview"
- WHEN they open the dashboard
- THEN the counts "Applied: 3" and "Interview: 1" are displayed
#### Scenario: Empty state
- GIVEN the user has no applications
- WHEN they open the dashboard
- THEN a zero-state message is displayed instead of counters

### Requirement: Pending Reminders List
The system MUST list all applications with overdue or due reminders, ordered by next_reminder_at ascending. Dismissed reminders MUST be excluded.

#### Scenario: Sorted pending list
- GIVEN two applications with reminders due on 2026-08-15 and 2026-08-17
- WHEN the user views the dashboard
- THEN the August 15 application appears before the August 17 application
#### Scenario: Empty pending list
- GIVEN no overdue reminders
- WHEN the user views the dashboard
- THEN the pending section shows a zero-state message

### Requirement: Quick Navigation
The system SHOULD provide links from each dashboard item to its application detail page.

#### Scenario: Navigate to detail
- GIVEN a pending reminder card
- WHEN the user clicks it
- THEN they are taken to the application detail page

## Non-Goals
- Rich analytics, charts, or trend lines
- Filterable data tables beyond status grouping
- Exportable reports

## Acceptance Criteria
- [ ] Dashboard displays counts for every status with a zero-state
- [ ] Pending reminders are sorted ascending by due date
- [ ] Clicking a reminder navigates to the application detail
