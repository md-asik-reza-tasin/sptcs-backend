# Smart Project & Task Collaboration System - Backend API

Backend API for managing users, roles, projects, tasks, activity logs, dashboard analytics, search, filtering, sorting, and pagination.

## Tech Stack

- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT
- bcryptjs

## Features

- User signup and login
- JWT authentication
- Role-based access control
- Admin, Manager, Member roles
- Project CRUD
- Task CRUD
- Task status update
- Task validation
- Duplicate task prevention inside same project
- Prevent past deadlines
- Prevent completed task reassignment
- Comments on tasks
- Activity logs
- Dashboard summary
- Search, filter, sort, pagination
- Member workload summary

## Environment Variables

Create a `.env` file in the project root using `.env.example` as a guide.

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=7d
```

## Installation

```bash
npm install
```

## Run Locally

```bash
npm run dev
```

## Production Start

```bash
npm start
```

## API Base URL

Local:

```txt
http://localhost:5000
```

Production:

```txt
Add deployed backend URL here
```

## Demo Credentials

Admin:

```txt
email: admin@test.com
password: 123456
```

Manager:

```txt
email: manager@test.com
password: 123456
```

Member:

```txt
email: member@test.com
password: 123456
```

## API Endpoints

Auth:

```txt
POST /api/auth/register
POST /api/auth/login
GET /api/auth/me
```

Users:

```txt
GET /api/users
```

Projects:

```txt
POST /api/projects
GET /api/projects
GET /api/projects/:id
PATCH /api/projects/:id
DELETE /api/projects/:id
```

Tasks:

```txt
POST /api/tasks
GET /api/tasks
GET /api/tasks/:id
PATCH /api/tasks/:id
DELETE /api/tasks/:id
PATCH /api/tasks/:id/status
POST /api/tasks/:id/comments
```

Dashboard:

```txt
GET /api/dashboard/summary
```

Activities:

```txt
GET /api/activities
```

## Deployment Instructions for Render

1. Push project to GitHub.
2. Go to Render.
3. Create a New Web Service.
4. Connect the GitHub repository.
5. Set the build command:

```bash
npm install
```

6. Set the start command:

```bash
npm start
```

7. Add environment variables:

```txt
PORT
MONGO_URI
JWT_SECRET
JWT_EXPIRE
```

8. Deploy.

## Important Notes

- Never push `.env` to GitHub.
- Use `.env.example` for sample environment variables.
- MongoDB Atlas IP access should allow the deployment server.
- Use a strong `JWT_SECRET` in production.
