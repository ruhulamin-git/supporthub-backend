# Support System - Backend API

REST API and WebSocket service built with Express, TypeScript, Socket.io, and PostgreSQL.

---

## 📋 Prerequisites

- **Node.js**: v18.0.0 or higher
- **PostgreSQL**: v14.0 or higher
- **npm**: v9.0.0 or higher

---

## 🚀 Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Create PostgreSQL Database
```bash
createdb support_system  or sudo -u postgres createdb support_system

```
*Or via psql:*
```sql
CREATE DATABASE support_system;
```

### 3. Configure Environment Variables
```bash
cp .env.example .env
```

Edit `.env` with your PostgreSQL credentials:
```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=support_system
DATABASE_USER=postgres
DATABASE_PASSWORD=your_postgres_password

JWT_SECRET=your_super_secret_jwt_key_min_32_characters
JWT_EXPIRES_IN=24h

PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### 4. Run Migrations & Seed Demo Data
```bash
# Create database schema and tables
npm run db:migrate

# Seed users (admin, agent, customer) and initial tickets
npm run db:seed
```

### 5. Start the Server
```bash
# Development mode with hot-reloading
npm run dev

# Production build & run
npm run build
npm start
```

Server will run at `http://localhost:5000` with WebSocket support at the same port.

---

## 📜 Available NPM Scripts

| Script | Purpose |
| :--- | :--- |
| `npm run dev` | Start development server with `ts-node-dev` |
| `npm run build` | Compile TypeScript to JavaScript in `/dist` |
| `npm start` | Run compiled production server |
| `npm run db:migrate` | Execute SQL migrations for database tables |
| `npm run db:seed` | Populate database with realistic demo accounts |

---

## 🔑 Demo Credentials

Seed the database via `npm run db:seed`. All accounts use password: `password123`

| Role | Email | Password |
| :--- | :--- | :--- |
| **Admin** | `admin@example.com` | `password123` |
| **Agent** | `agent1@example.com` | `password123` |
| **Customer** | `customer1@example.com` | `password123` |
