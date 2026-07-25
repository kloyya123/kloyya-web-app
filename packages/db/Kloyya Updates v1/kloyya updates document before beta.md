# KLOYYA BETA UPDATE SPECIFICATION
## Version 0.2 – Private Beta Improvements

**Purpose**

This document defines the next iteration of Kloyya before the private beta launch. The goal is to complete missing functionality, improve onboarding, remove unfinished features, and create an experience where every user immediately understands the value of Kloyya.

**Core Principle**

> Every feature should make users feel:
>
> **"Kloyya should have existed a long time ago."**

The product should reduce friction, save time, provide trustworthy AI assistance, and fit naturally into the way people already work.

---

# 1. Fix Drafts

**Priority:** Critical

The Draft feature is currently unavailable.

Implement a complete drafting experience.

### Users should be able to:

- Create drafts
- Edit drafts
- Auto-save drafts
- Delete drafts
- Organize drafts
- Resume editing later

Supported draft types:

- Emails
- Notes
- Reports
- Documents
- Meeting summaries

---

# 2. Redesign Onboarding

**Priority:** Critical

Kloyya should never assume which tools a user uses.

Users must explicitly connect the tools they want before a workspace is created.

## Updated Onboarding Flow

```
Welcome

↓

Create Account

↓

Verify Email

↓

Connect Your Tools

↓

Authenticate Selected Tools

↓

AI Personalization

↓

Create Workspace

↓

Initial Sync

↓

Building Your Workspace...

↓

Workspace Ready
```

The onboarding should feel fast, guided, and intelligent.

---

# 3. AI Personalization (New)

**Priority:** Critical

Before entering their workspace, users should answer a few questions so Kloyya understands how they work.

### Ask:

**What best describes your role?**

Examples:

- Founder
- CEO
- Executive
- Manager
- Developer
- Designer
- Sales
- Marketing
- Operations
- Student

---

**What do you want Kloyya to help with most?**

Examples:

- Managing work
- Organizing projects
- Research
- Meetings
- Email
- Productivity
- Planning
- Decision making

---

**What are your top priorities right now?**

Allow users to select or type multiple priorities.

---

**How proactive should Kloyya be?**

- Minimal
- Balanced
- Highly Proactive

---

These answers personalize:

- Recommendations
- Search
- Daily briefings
- AI responses
- Suggested workflows
- Priorities

---

# 4. Build "Ask Kloyya"

**Priority:** Critical

Users currently have no way to interact with the AI.

Implement a persistent AI assistant available throughout the application.

Capabilities:

- Ask questions
- Search connected tools
- Search uploaded files
- Generate summaries
- Draft content
- Explain recommendations
- Create tasks
- Retrieve workspace knowledge

---

# 5. Complete Profile & Settings

**Priority:** High

Replace placeholders with fully functional pages.

### Profile

- Name
- Photo
- Job title
- Time zone
- Language
- Password
- Connected accounts

### Workspace

- Workspace name
- Logo
- Preferences

### Security

- Active sessions
- Connected tools
- Delete account

### Notifications

- Email
- AI updates
- Weekly summaries

---

# 6. Redesign Trust Centre

**Priority:** High

Trust Centre should explain exactly how Kloyya generated every answer.

Display:

- Connected tools searched
- Uploaded files referenced
- External sources (if used)
- Why each source was selected
- Confidence score
- Last updated time

The goal is transparency and trust—not just a list of integrations.

---

# 7. File Upload & Document Scanning

**Priority:** High

Users should be able to upload digital files or scan physical documents.

Supported formats:

- PDF
- DOCX
- TXT
- Markdown
- CSV
- XLSX
- PPTX
- PNG
- JPG
- JPEG
- WEBP

### Scanner

Allow users to:

- Scan paper documents
- Auto-crop
- Enhance readability
- OCR (convert to searchable text)
- Save securely

Every uploaded document becomes searchable by Kloyya.

---

# 8. Remove Organizations

**Priority:** Medium

Organizations are removed during private beta.

Everything operates around a single Workspace.

Enterprise organization support will return later.

---

# 9. Improve Projects

Projects should support:

- Create
- Rename
- Delete
- Archive
- Duplicate
- Import projects
- Attach files
- Due dates

Only display import options that have actually been implemented.

---

# 10. Improve Tasks

Tasks should allow users to:

- Create
- Edit
- Delete
- Complete
- Reopen
- Add notes
- Attach files
- Share
- Filter
- Search
- Group by project

The experience should feel lightweight, fast, and intuitive.

---

# 11. Connected Tools

Only display integrations that actually exist.

### Rules

- Never auto-connect tools.
- Never display unfinished integrations.
- Never show placeholder integrations.
- Only show tools the user has connected.
- Users remain in full control.

### Current Beta Integrations

- Gmail
- Outlook
- Google Calendar
- Outlook Calendar
- Google Drive
- Notion
- Uploaded Documents

Future integrations will only appear once they are fully implemented and tested.

---

# 12. Connected Sources Panel

Whenever Kloyya searches for information, users should know where it came from.

Example:

```
Searching through...

✓ Email

✓ Calendar

✓ Google Drive

✓ Notion

✓ Uploaded Documents

✓ Workspace Memory

✓ Knowledge Graph
```

Future versions should also show:

- Sync status
- Last updated
- Confidence score
- Source freshness
- Why a source was included
- Why a source was excluded

---

# 13. User Experience Principles

Every screen should be designed around the following principles.

## Simplicity

Reduce clicks.

Reduce unnecessary decisions.

Keep interfaces clean.

---

## Intelligence

Kloyya should understand context before asking unnecessary questions.

---

## Transparency

Always explain where answers come from.

---

## Speed

Every interaction should feel instant.

---

## Trust

Users should always know:

- What data Kloyya accessed
- Why it accessed it
- How recommendations were generated

---

## Control

Users can:

- Connect tools
- Disconnect tools
- Pause syncing
- Delete uploaded files
- Remove workspace data
- Export their information

---

# Success Criteria

The beta experience is considered successful when a new user can:

- Sign up in under three minutes.
- Connect only the tools they actually use.
- Personalize Kloyya to their role and goals.
- Upload documents and scan paper files.
- Ask Kloyya meaningful questions immediately.
- Understand where every answer came from.
- Manage projects and tasks easily.
- Feel confident their data is secure.
- Finish onboarding believing Kloyya naturally fits into their daily workflow.

---

# Final Product Goal

Kloyya should become the intelligent layer above work—not another application users have to learn.

The experience should feel personal, trustworthy, proactive, and effortless, making users think:

> **"This should have existed years ago."**