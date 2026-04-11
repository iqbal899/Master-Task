# MasterTask — Full Stack Project Management Platform

## Overview

MasterTask is a full-stack project management platform inspired by Jira. It is designed to help teams organize work efficiently through structured workflows, task tracking, and collaboration.

The application supports workspace-based collaboration, project organization, and multiple task views such as Kanban and Calendar. The focus of this project is on scalable architecture, type-safe APIs, and efficient data handling.

---

## Features

- Workspace-based multi-tenant system
- Project and task management (CRUD operations)
- Kanban board with drag-and-drop functionality
- Calendar view for task scheduling
- Table view for structured task management
- Role-based access control (Admin and Member)
- Invite system for workspace collaboration
- Authentication (Email/Password and OAuth)
- Image upload support for projects
- Task filtering by status, assignee, project, and due date

---

## Tech Stack

### Frontend
- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS
- ShadCN UI

### Backend
- Hono (Type-safe API framework)
- Appwrite (Authentication, Database, Storage)

### State Management
- React Query (TanStack Query)

### Validation
- Zod
- React Hook Form

---

## Architecture

- Feature-based modular structure
- Type-safe API layer using Hono RPC
- Middleware-based authentication
- Server-state management using React Query
- URL-based state management for filters and views

---

## User Flow

1. User signs in using email/password or OAuth.
2. User creates or joins a workspace.
3. Projects are created inside a workspace.
4. Tasks are created and assigned to members.
5. Tasks are managed using Table, Kanban, or Calendar views.
6. Admin users manage members and workspace settings.

---

## Database Design

The application uses a collection-based NoSQL structure.

### Collections

Workspaces
- name
- imageUrl
- inviteCode
- userId

Members
- userId
- workspaceId
- role
- name
- email

Projects
- name
- imageUrl
- workspaceId

Tasks
- name
- status
- workspaceId
- projectId
- assigneeId
- dueDate
- position

---

## Key Design Decisions

- Multi-tenant architecture using workspaceId
- Role-based access control using members collection
- Position-based ordering for efficient Kanban updates
- Bulk updates to reduce API calls
- Denormalized data for faster UI rendering

---

## API Design

- RESTful endpoints
- Type-safe communication using Hono RPC
- Middleware-based authentication and authorization
- Structured request handling (params, query, JSON)

---
