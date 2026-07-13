require("dotenv").config();
const mysql = require("mysql2/promise");

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Example: mysql://user:password@your-db.xxxx.us-east-1.rds.amazonaws.com:3306/moviecloud"
  );
}

const dbUrl = new URL(process.env.DATABASE_URL);

const pool = mysql.createPool({
  host: dbUrl.hostname,
  port: dbUrl.port ? Number(dbUrl.port) : 3306,
  user: decodeURIComponent(dbUrl.username),
  password: decodeURIComponent(dbUrl.password),
  database: dbUrl.pathname.replace(/^\//, ""),
  // Most RDS instances accept plain TCP by default, but if yours enforces
  // SSL, set DB_SSL=true and this uses mysql2's bundled Amazon RDS CA.
  ssl: process.env.DB_SSL === "true" ? "Amazon RDS" : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;