const { Pool } = require("pg")
require("dotenv").config()

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "finalProj_db",
  password: process.env.DB_PASSWORD || "admin",
  port: Number.parseInt(process.env.DB_PORT) || 5432,
})

// Дерекқор байланысын тексеру
const testConnection = async () => {
  try {
    const client = await pool.connect()
    console.log("✅ PostgreSQL дерекқорына сәтті қосылды")
    client.release()
  } catch (error) {
    console.error("❌ Дерекқор қосылу қатесі:", error.message)
    console.log("🔧 Дерекқор параметрлерін тексеріңіз:")
    console.log(`   - Host: ${process.env.DB_HOST}`)
    console.log(`   - Port: ${process.env.DB_PORT}`)
    console.log(`   - Database: ${process.env.DB_NAME}`)
    console.log(`   - User: ${process.env.DB_USER}`)
  }
}

// Дерекқор кестелерін жасау
const createTables = async () => {
  try {
    // Алдымен байланысты тексеру
    await testConnection()

    // Users кестесі
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        avatar TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // Plant Scans кестесі
    await pool.query(`
      CREATE TABLE IF NOT EXISTS plant_scans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        image_url TEXT NOT NULL,
        common_name VARCHAR(255),
        scientific_name VARCHAR(255),
        description TEXT,
        origin VARCHAR(255),
        sunlight VARCHAR(255),
        water VARCHAR(255),
        growth_rate VARCHAR(255),
        accuracy INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    console.log("✅ Дерекқор кестелері сәтті жасалды")
  } catch (error) {
    console.error("❌ Дерекқор қатесі:", error.message)
  }
}

module.exports = { pool, createTables }
