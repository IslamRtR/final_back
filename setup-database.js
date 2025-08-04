const { Pool } = require("pg") // PostgreSQL үшін Pool класын импорттау
require("dotenv").config() // .env файлын жүктеу

const setupDatabase = async () => {
  // Алдымен PostgreSQL дерекқорына қосылу
  const adminPool = new Pool({
    user: process.env.DB_USER || "postgres", // Дерекқор қолданушысы
    host: process.env.DB_HOST || "localhost", // Дерекқор хосты
    database: "postgres", // Әдепкі "postgres" дерекқоры
    password: process.env.DB_PASSWORD || "admin", // Қолданушының құпия сөзі
    port: Number.parseInt(process.env.DB_PORT) || 5432, // Порт нөмірі
  })

  try {
    console.log("🔧 Дерекқорды орнатуда...") // Дерекқорды орнату басталғанын хабарлау

    // Дерекқордың бар-жоғын тексеру
    const dbExists = await adminPool.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      process.env.DB_NAME || "finalProj_db", // Дерекқор атауын алу
    ])

    if (dbExists.rows.length === 0) {
      // Егер дерекқор жоқ болса, оны құру
      await adminPool.query(`CREATE DATABASE "${process.env.DB_NAME || "finalProj_db"}"`)
      console.log(`✅ Дерекқор "${process.env.DB_NAME}" жасалды`) // Дерекқор жасалғанын хабарлау
    } else {
      console.log(`✅ Дерекқор "${process.env.DB_NAME}" бұрын жасалған`) // Дерекқор бар екенін хабарлау
    }

    await adminPool.end() // Админ дерекқорымен жұмыс аяқталды

    // Енді жаңа дерекқорға қосылу
    const projectPool = new Pool({
      user: process.env.DB_USER || "postgres", // Дерекқор қолданушысы
      host: process.env.DB_HOST || "localhost", // Дерекқор хосты
      database: process.env.DB_NAME || "finalProj_db", // Жаңа дерекқор атауы
      password: process.env.DB_PASSWORD || "admin", // Қолданушының құпия сөзі
      port: Number.parseInt(process.env.DB_PORT) || 5432, // Порт нөмірі
    })

    // Кестелерді жасау
    await projectPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,  // Пайдаланушының идентификаторы
        full_name VARCHAR(255) NOT NULL,  // Толық аты
        email VARCHAR(255) UNIQUE NOT NULL,  // Email адресі (уникалды)
        password VARCHAR(255) NOT NULL,  // Құпия сөз
        avatar TEXT,  // Профиль суреті
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  // Жасалған уақыт
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP  // Жаңартылған уақыт
      );
    `)

    await projectPool.query(`
      CREATE TABLE IF NOT EXISTS plant_scans (
        id SERIAL PRIMARY KEY,  // Өсімдік сканерлеудің идентификаторы
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,  // Пайдаланушының идентификаторы (шетел кілті)
        image_url TEXT NOT NULL,  // Сканерленген өсімдік суретінің URL
        common_name VARCHAR(255),  // Өсімдіктің жалпы атауы
        scientific_name VARCHAR(255),  // Өсімдіктің ғылыми атауы
        description TEXT,  // Сипаттама
        origin VARCHAR(255),  // Өсімдіктің шыққан жері
        sunlight VARCHAR(255),  // Күнге деген қажеттілік
        water VARCHAR(255),  // Су қажеттілігі
        growth_rate VARCHAR(255),  // Өсу қарқыны
        accuracy INTEGER,  // Тексеріс нәтижесінің дәлдігі
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP  // Сканерлеу уақыты
      );
    `)

    console.log("✅ Барлық кестелер сәтті жасалды") // Кестелердің сәтті жасалғаны туралы хабарлау
    await projectPool.end() // Дерекқормен жұмыс аяқталды

    console.log("🎉 Дерекқор орнату аяқталды!") // Дерекқор орнату аяқталғанын хабарлау
    process.exit(0) // Скрипттің сәтті аяқталуы
  } catch (error) {
    console.error("❌ Дерекқор орнату қатесі:", error.message) // Қате туралы хабарлау
    console.log("\n🔧 Мүмкін шешімдер:") // Мүмкін болатын шешімдер
    console.log("1. PostgreSQL сервері іске қосылған ба тексеріңіз")
    console.log("2. .env файлындағы дерекқор параметрлерін тексеріңіз")
    console.log("3. Қолданушы құқықтарын тексеріңіз")
    process.exit(1) // Қате болған жағдайда процесс аяқталады
  }
}

setupDatabase() // Функцияны шақыру
