# Applications Specification

## Purpose
Track individual job applications with a status workflow, audit history, mandatory platform association, job proposal capture, and resume/contact linkage.

## Requirements

### Requirement: Application CRUD
The system MUST allow users to create, read, update, and delete applications. Each application MUST belong to exactly one user.

#### Scenario: Create application
- GIVEN the user is authenticated
- WHEN they submit an application with company name, position title, and platform URL
- THEN the application is persisted and visible in the list
#### Scenario: Delete application
- GIVEN an existing application
- WHEN the user deletes it
- THEN all related history, reminders, and attachments are removed
#### Scenario: Validation on create
- GIVEN the user submits an application without a company name
- WHEN validation runs
- THEN creation is rejected with an observable error

### Requirement: Mandatory Platform URL
Every application MUST include a platform URL. The system SHALL infer the platform from the URL hostname. If inference fails, the user MUST select or enter a platform manually.

#### Scenario: Automatic inference
- GIVEN a platform URL with a known hostname
- WHEN the application is created
- THEN the platform is linked automatically
#### Scenario: Manual fallback
- GIVEN a platform URL with an unknown hostname
- WHEN inference returns no match
- THEN the user MUST select from a searchable combobox or enter a custom platform
#### Scenario: Invalid URL rejected
- GIVEN a malformed platform URL
- WHEN the form is submitted
- THEN the submission is rejected with an observable validation error

### Requirement: Status Workflow and History
The system MUST support a configurable status list. Every status change MUST append a row to StatusHistory with from_status, to_status, and timestamp. The application last_update_date MUST update on every status change.

#### Scenario: Status change records history
- GIVEN an application in status "Applied"
- WHEN the user changes status to "Interview"
- THEN a history row is created and last_update_date is updated to the change timestamp
#### Scenario: Terminal status disables reminders
- GIVEN an application in a terminal status (Rejected, Withdrawn, Hired)
- WHEN a reminder check runs
- THEN no reminder is scheduled for that application

### Requirement: Job Proposal Capture
The system MUST allow capturing the job proposal as pasted text, uploaded file, or external URL. At least one capture method MAY be provided per application, but all three formats MUST be supported by the system.

#### Scenario: Paste proposal text
- GIVEN the user is viewing an application
- WHEN they paste text into the proposal field
- THEN the text is saved and retrievable
#### Scenario: Upload proposal file
- GIVEN the user selects a PDF or DOCX file under the size limit
- WHEN they upload it as the job proposal
- THEN the file is stored and linked to the application
#### Scenario: Link proposal URL
- GIVEN the user enters a valid HTTP(S) URL
- WHEN they save the application
- THEN the URL is stored and clickable
#### Scenario: Invalid proposal URL rejected
- GIVEN the user enters a malformed URL in the proposal URL field
- WHEN they save
- THEN the system displays an observable validation error and refuses to save
#### Scenario: Oversized proposal file rejected
- GIVEN the user selects a proposal file exceeding the maximum size limit
- WHEN they attempt to save
- THEN the system displays an observable validation error and refuses to save

### Requirement: Resume and Contact Linkage
The system MUST allow attaching one resume version and multiple contacts to an application.

#### Scenario: Attach resume
- GIVEN an existing resume version
- WHEN the user selects it for an application
- THEN the attachment is recorded with a timestamp
#### Scenario: Attach contact with role
- GIVEN an existing contact
- WHEN the user links the contact to an application with a role
- THEN the role is stored in the join table
#### Scenario: Remove contact linkage
- GIVEN an application with a linked contact
- WHEN the user removes the linkage
- THEN the role assignment is deleted without deleting the contact

## Non-Goals
- Team collaboration or multi-tenant sharing
- Content scraping for platform detection (hostname only)
- Salary history tracking per application
- Automated cover-letter generation

## Acceptance Criteria
- [ ] User can create, update, and delete an application with mandatory platform URL
- [ ] Status changes produce immutable history rows
- [ ] Job proposal supports text, file, and URL with validation
- [ ] Resume and contacts can be attached and detached
