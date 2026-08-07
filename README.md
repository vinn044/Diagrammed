# Diagrammed - Interactive system design practice tool with diagramming and AI-generated feedback


This application helps students and job-seekers practice system design interviews in a realistic, interactive format. Users are presented with a design prompt (e.g. "design a URL shortener"), build an architecture diagram using a whiteboard style canvas, and answer clarifying questions along the way. An AI evaluates the design against a rubric and provides structured feedback. 

This platform came to mind since I've seen an abundance of interactive resources for typical leetcode style interview prep, but nowhere near the amount for system design specifically. I've personally had to rely more on traditional studying e.g. books.


## Agile Planning

### Product Backlog (User Stories)
- As a user, I want to create an account and log in so I can save my progress
- As a user, I want to select a system design prompt (e.g. "design a URL shortener") to practice
- As a user, I want to build an architecture diagram using a drag-and-drop canvas
- As a user, I want to answer clarifying questions during my design session
- As a user, I want to receive AI-generated feedback on my design when I submit it
- As a user, I want to view my past practice sessions and track my progress over time
- As an admin, I want to add and manage design prompts and their grading rubrics

### Sprint Plan

**Sprint 1 (Weeks 1-2): Foundation**
- Set up Django project, environment, repo (complete)
- Implement user authentication (register/login) (complete)
- Design and implement core data models (User, Prompt, Session) (complete)

**Sprint 2 (Weeks 3-4): Core Feature - Prompts & Diagram**
- Save/load diagram state to backend (complete)
- Build diagram canvas (frontend) with draggable components (in-progress)
- CRUD for design prompts (admin-facing)


**Sprint 3 (Weeks 5-6): AI Integration**
- Integrate AI API for grading
- Build rubric-based feedback structure
- Display feedback to user after session submission

**Sprint 4 (Weeks 7-8): Polish & Testing**
- Session history / progress dashboard
- Testing (unit + manual QA)
- UI polish, bug fixes, final documentation
