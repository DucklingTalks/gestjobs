# Resumes Specification

## Purpose
Store versioned resumes with metadata, allow uploads, and track which version was attached to each application.

## Requirements

### Requirement: Resume Upload and Versioning
The system MUST allow users to upload resume files. Each upload MUST create a new version with a user-defined label and stored metadata (file path/hash, upload date).

#### Scenario: Upload new resume
- GIVEN the user selects a PDF or DOCX file under the max size limit
- WHEN they upload it with a label "Frontend-Senior"
- THEN the file is stored and a version record is created
#### Scenario: Upload duplicate content
- GIVEN a file with the same hash as an existing version
- WHEN the user uploads it
- THEN the system MAY warn or create a new version based on user choice
#### Scenario: Invalid file type rejected
- GIVEN the user selects a .exe file
- WHEN they attempt to upload
- THEN the system rejects the upload with an observable validation error
#### Scenario: Oversized file rejected
- GIVEN a file exceeding the configured maximum size
- WHEN the user attempts to upload
- THEN the system rejects the upload with an observable validation error

### Requirement: Per-Application Attachment
The system MUST allow attaching exactly one resume version to an application at any time. The attachment timestamp MUST be recorded.

#### Scenario: Attach resume to application
- GIVEN an application and a resume version
- WHEN the user selects the resume
- THEN the join record is created and visible on the application
#### Scenario: Change attached resume
- GIVEN an application with an attached resume
- WHEN the user selects a different version
- THEN the new version replaces the previous attachment
#### Scenario: Detach resume
- GIVEN an application with an attached resume
- WHEN the user removes the attachment
- THEN the join record is deleted and the application has no linked resume

## Non-Goals
- Automatic resume formatting or tailoring
- AI-generated resume suggestions
- Public resume sharing links

## Acceptance Criteria
- [ ] PDF and DOCX uploads create versioned records with labels
- [ ] Invalid types and oversized files are rejected with clear errors
- [ ] Exactly one resume can be attached per application
- [ ] Changing or removing an attachment updates the record immediately
