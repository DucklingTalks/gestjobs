# Contacts Specification

## Purpose
Maintain a reusable contact directory and record per-application roles (e.g., recruiter, hiring manager).

## Requirements

### Requirement: Contact Directory CRUD
The system MUST allow users to create, read, update, and delete contacts. Each contact MUST belong to exactly one user.

#### Scenario: Create contact
- GIVEN the user fills name and email
- WHEN they save the contact
- THEN it appears in the global contact list
#### Scenario: Validation on create
- GIVEN the user submits a contact without a name
- WHEN validation runs
- THEN creation is rejected with an observable error
#### Scenario: Update contact
- GIVEN an existing contact
- WHEN the user edits the name or email
- THEN the changes are persisted and reflected everywhere the contact is used
#### Scenario: Delete contact
- GIVEN a contact linked to no applications
- WHEN the user deletes it
- THEN the contact is removed from the directory

### Requirement: Per-Application Role Assignment
The system MUST allow linking one or more contacts to an application with a role.

#### Scenario: Assign recruiter
- GIVEN a contact "Jane Doe" and an application
- WHEN the user links Jane as "Recruiter"
- THEN the role is stored and displayed on the application detail page
#### Scenario: Reuse contact across applications
- GIVEN a contact linked to application A as "Referrer"
- WHEN the user links the same contact to application B as "Hiring Manager"
- THEN both role assignments are stored independently
#### Scenario: Remove role assignment
- GIVEN a contact linked to an application as "Recruiter"
- WHEN the user removes that role
- THEN the join record is deleted without affecting the contact directory

## Non-Goals
- Bulk contact import (CSV, LinkedIn)
- Messaging or email integration with contacts
- Organization-level contact directories

## Acceptance Criteria
- [ ] Contacts can be created, updated, and deleted with validation
- [ ] A contact can be linked to multiple applications with independent roles
- [ ] Removing a role from an application does not delete the contact
