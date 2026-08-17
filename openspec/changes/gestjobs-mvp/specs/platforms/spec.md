# Platforms Specification

## Purpose
Identify and manage job platforms through URL hostname inference, a seeded directory of Latin-American boards (especially Uruguay), and a searchable combobox with free-text fallback.

## Requirements

### Requirement: Hostname Inference
The system MUST extract the hostname from any platform URL and match it against a normalized platform directory.

#### Scenario: Known hostname
- GIVEN a URL from "linkedin.com"
- WHEN the application form is submitted
- THEN the platform is resolved to "LinkedIn"
#### Scenario: Unknown hostname
- GIVEN a URL from an unseeded domain
- WHEN inference runs
- THEN no automatic match is returned and fallback is triggered
#### Scenario: Invalid URL rejected
- GIVEN a malformed or non-HTTP(S) URL
- WHEN the application is submitted
- THEN the system displays an observable validation error

### Requirement: Seeded Platform Directory
The system MUST ship with preloaded well-known job platforms in Latin America, especially Uruguay.

#### Scenario: Search seeded platforms
- GIVEN the user opens the platform selector
- WHEN they type "gallito"
- THEN "Gallito Uruguay" appears in the combobox results
#### Scenario: Search broad Latin-American board
- GIVEN the user types "computrabajo"
- WHEN the combobox filters
- THEN "Computrabajo" appears in the results

### Requirement: Searchable Combobox and Manual Fallback
The system MUST provide a searchable combobox for platform selection. If the desired platform is missing, the user MAY enter a custom name; custom platforms MUST be persisted per user.

#### Scenario: Custom platform entry
- GIVEN no match for the hostname or search query
- WHEN the user types a new platform name and confirms
- THEN the custom platform is saved and linked to the application
#### Scenario: Reuse custom platform
- GIVEN a previously entered custom platform
- WHEN the user searches for it later
- THEN it appears in their personal platform list
#### Scenario: Normalized hostname storage
- GIVEN a URL with a "www." prefix or trailing path
- WHEN the platform is saved
- THEN the stored hostname is normalized (e.g., "boards.greenhouse.io")

## Non-Goals
- Content scraping or page-title inference
- Crowdsourced platform directory (custom platforms are private per user)
- External API synchronization for platform lists

## Acceptance Criteria
- [ ] Hostname is extracted and matched automatically from any valid URL
- [ ] Preloaded Latin-American/Uruguayan platforms appear in the combobox
- [ ] Custom platforms are saved per user and reusable
- [ ] Malformed URLs produce observable validation errors
