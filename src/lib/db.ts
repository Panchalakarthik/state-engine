import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.SINGLESTORE_HOST,
  port: Number(process.env.SINGLESTORE_PORT ?? 3333),
  user: process.env.SINGLESTORE_USER,
  password: process.env.SINGLESTORE_PASSWORD,
  database: process.env.SINGLESTORE_DATABASE,
  ssl: { rejectUnauthorized: false },
  waitForConnections: true,
  connectionLimit: 10,
  connectTimeout: 3000,
});

export default pool;
