# Warehouse Stock Movement & Batch Tracking System

A web-based warehouse inventory management system developed as a DBMS mini project.

## Technologies Used
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js and Express.js
- Database: MySQL
- MySQL Driver: mysql2

## Project Structure

```text
warehouse-tracking-system/
├── public/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── server.js
├── package.json
├── package-lock.json
├── .env.example
└── .gitignore
```

## Setup Instructions

1. Clone the repository:

```bash
git clone https://github.com/sushruthacm-bit/warehouse-tracking-system.git
```

2. Open the project folder:

```bash
cd warehouse-tracking-system
```

3. Install dependencies:

```bash
npm install
```

4. Create a `.env` file using `.env.example` as a template.

5. Enter your own MySQL connection details in `.env`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password
DB_NAME=warehouse_tracking
PORT=3000
```

6. Make sure the required database tables and stored procedures are created in MySQL.

7. Start the backend:

```bash
node server.js
```

8. Open the application:

http://localhost:3000

## Important Notes

- Never upload `.env` or database passwords to GitHub.
- The frontend communicates with MySQL through the Express backend.
- The backend currently expects stored procedures such as `GetInventory`, `GetLowStock`, `AddStock`, `RemoveStock`, and `TransferStock`.
- Database schema and stored procedures must be checked and integrated with the final team database.

## Team Integration

This repository contains the website frontend and Express backend. The database integration and final schema compatibility will be completed during team integration.