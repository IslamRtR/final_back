const { Pool } = require("pg") // PostgreSQL-ге қосылу үшін Pool классын импорттау
require("dotenv").config() // .env файлындағы айнымалыларды жүктеу

// PostgreSQL дерекқорына қосылу үшін Pool конфигурациясы
const pool = new Pool({
  connectionString: 'postgresql://isa:xA2DQem4gXzN9X8RzhqWp8amcVJTmNJj@dpg-d289pjp5pdvs738bivu0-a.oregon-postgres.render.com/qaragul_db',
  ssl: { rejectUnauthorized: false } 
})

// Дерекқор байланысын тексеру
const testConnection = async () => {
  try {
    const client = await pool.connect() // Дерекқорға қосылу
    console.log("✅ PostgreSQL дерекқорына сәтті қосылды")
    client.release() // Қосылымды босату
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

    // Users кестесін жасау (қолданушылар туралы мәліметтер)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY, -- Бірегей ID
        full_name VARCHAR(255) NOT NULL, -- Толық аты
        email VARCHAR(255) UNIQUE NOT NULL, -- Email (бірегей)
        password VARCHAR(255) NOT NULL, -- Құпия сөз
        avatar TEXT, -- Профиль суреті
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Жасалған уақыты
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Соңғы рет жаңартылған уақыты
      );
    `)

    // Plant Scans кестесін жасау (өсімдіктердің сканерлеу тарихы)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS plant_scans (
        id SERIAL PRIMARY KEY, -- Бірегей ID
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- Қолданушыға сілтеме
        image_url TEXT NOT NULL, -- Сурет URL
        common_name VARCHAR(255), -- Өсімдіктің қазақша атауы
        scientific_name VARCHAR(255), -- Өсімдіктің ғылыми атауы
        description TEXT, -- Өсімдіктің сипаттамасы
        origin VARCHAR(255), -- Өсімдіктің шығу тегі
        sunlight VARCHAR(255), -- Жарық қажеттілігі
        water VARCHAR(255), -- Суару режимі
        growth_rate VARCHAR(255), -- Өсу қарқыны
        accuracy INTEGER, -- Дәлдік (0-100)
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Сканерлеу уақыты
      );
    `)

    console.log("✅ Дерекқор кестелері сәтті жасалды") // Кестелер сәтті жасалғанын хабарлау
  } catch (error) {
    console.error("❌ Дерекқор қатесі:", error.message) // Қате болса, хабарлау
  }
}

module.exports = { pool, createTables } // pool және createTables функцияларын экспорттау
