// Дерекқорды орнату скрипті
const { Pool } = require("pg")
require("dotenv").config()

const setupDatabase = async () => {
  // Алдымен postgres дерекқорына қосылу
  const adminPool = new Pool({
    user: process.env.DB_USER || "postgres",
    host: process.env.DB_HOST || "localhost",
    database: "postgres", // Әдепкі postgres дерекқоры
    password: process.env.DB_PASSWORD || "admin",
    port: Number.parseInt(process.env.DB_PORT) || 5432,
  })

  try {
    console.log("🔧 Дерекқорды орнатуда...")

    // Дерекқор бар ма тексеру
    const dbExists = await adminPool.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      process.env.DB_NAME || "finalProj_db",
    ])

    if (dbExists.rows.length === 0) {
      // Дерекқор жасау
      await adminPool.query(`CREATE DATABASE "${process.env.DB_NAME || "finalProj_db"}"`)
      console.log(`✅ Дерекқор "${process.env.DB_NAME}" жасалды`)
    } else {
      console.log(`✅ Дерекқор "${process.env.DB_NAME}" бұрын жасалған`)
    }

    await adminPool.end()

    // Енді жаңа дерекқорға қосылу
    const projectPool = new Pool({
      user: process.env.DB_USER || "postgres",
      host: process.env.DB_HOST || "localhost",
      database: process.env.DB_NAME || "finalProj_db",
      password: process.env.DB_PASSWORD || "admin",
      port: Number.parseInt(process.env.DB_PORT) || 5432,
    })

    // Кестелерді жасау
    await projectPool.query(`
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

    await projectPool.query(`
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

    console.log("✅ Барлық кестелер сәтті жасалды")
    await projectPool.end()

    console.log("🎉 Дерекқор орнату аяқталды!")
    process.exit(0)
  } catch (error) {
    console.error("❌ Дерекқор орнату қатесі:", error.message)
    console.log("\n🔧 Мүмкін шешімдер:")
    console.log("1. PostgreSQL сервері іске қосылған ба тексеріңіз")
    console.log("2. .env файлындағы дерекқор параметрлерін тексеріңіз")
    console.log("3. Қолданушы құқықтарын тексеріңіз")
    process.exit(1)
  }
}

setupDatabase()
