const express = require("express") // Express кітапханасын қосу
const cors = require("cors") // CORS қолдауы үшін кітапхана
const path = require("path") // Путьтермен жұмыс істеу үшін кітапхана
const rateLimit = require("express-rate-limit") // Қызметті шектеу үшін кітапхана
require("dotenv").config() // .env файлынан орта айнымалыларын жүктеу

const { createTables } = require("./config/database") // Дерекқорға арналған функция
const authRoutes = require("./routes/auth") // Авторизация маршруты
const plantsRoutes = require("./routes/plants") // Өсімдіктер маршруты

const app = express() // Express қосымшасын инициализациялау
const PORT = process.env.PORT || 5002 // Порт нөмірі, .env файлына сәйкес немесе 5002

// Дерекқор кестелерін жасау
createTables()

// Uploads папкасын жасау (егер жоқ болса)
const fs = require("fs")
const uploadsDir = "uploads"
if (!fs.existsSync(uploadsDir)) { // Егер "uploads" папкасы жоқ болса
  fs.mkdirSync(uploadsDir) // Папканы жасау
  console.log("📁 Uploads папкасы жасалды")
}

// Сұраныстарды шектеу үшін rate-limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // Максимум 100 сұраныс
})

// Middleware - қолданысқа енгізу
app.use(limiter) // Rate limiting қосу
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173", // CORS конфигурациясы
    credentials: true, // Кукилерді қолдануға рұқсат беру
  }),
)
app.use(express.json({ limit: "10mb" })) // JSON форматындағы денелерді өңдеу
app.use(express.urlencoded({ extended: true, limit: "10mb" })) // URL-кодталған деректерді өңдеу

// Статикалық файлдарды беру
app.use("/uploads", express.static("uploads")) // "uploads" папкасынан статикалық файлдар ұсыну

// Маршруттар
app.use("/api/auth", authRoutes) // Авторизацияға арналған маршрут
app.use("/api/plants", plantsRoutes) // Өсімдіктерге арналған маршрут

// Денсаулықты тексеру (health check) маршруты
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK", // Сервердің жай-күйі
    timestamp: new Date().toISOString(), // Қазіргі уақыт
    uptime: process.uptime(), // Сервердің жұмыс уақыты
    environment: process.env.NODE_ENV || "development", // Ортаның күйі
  })
})

// Қате өңдеу middleware
app.use((error, req, res, next) => {
  console.error("🚨 Сервер қатесі:", error) // Қате туралы хабар

  // Файл өлшемі тым үлкен болса
  if (error.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "Файл өлшемі тым үлкен (максимум 5MB)" })
  }

  // Сурет файлдары ғана қабылданады
  if (error.message === "Тек сурет файлдары ғана қабылданады") {
    return res.status(400).json({ error: error.message })
  }

  // Жалпы сервер қатесі
  res.status(500).json({
    error: "Сервер қатесі",
    details: process.env.NODE_ENV === "development" ? error.message : undefined, // Даму ортасында қосымша ақпарат
  })
})

// 404 қатесі: жол табылмаса
app.use("*", (req, res) => {
  console.log(`❌ 404: ${req.method} ${req.originalUrl}`) // Қате туралы хабар
  res.status(404).json({ error: "API endpoint табылмады" }) // 404 қатесі
})

// Сервер іске қосу
app.listen(PORT, () => {
  console.log(`🚀 Сервер ${PORT} портында іске қосылды`) // Сервер туралы хабар
  console.log(`📁 API мекенжайы: http://localhost:${PORT}`) // API мекенжайы
  console.log(`🌐 CORS: ${process.env.CLIENT_URL || "http://localhost:5173"}`) // CORS мекенжайы
  console.log(`🤖 Gemini API: ${process.env.GOOGLE_GEMINI_API_KEY ? "ҚОСЫЛҒАН ✅" : "ҚОСЫЛМАҒАН ❌"}`) // Gemini API күйі
  console.log(`💾 JWT Secret: ${process.env.JWT_SECRET ? "ҚОСЫЛҒАН ✅" : "ҚОСЫЛМАҒАН ❌"}`) // JWT Secret күйі

  // Қолжетімді API эндпоинттері
  console.log("\n📋 Қолжетімді API endpoints:")
  console.log("  POST /api/auth/register")
  console.log("  POST /api/auth/login")
  console.log("  GET  /api/auth/profile")
  console.log("  POST /api/plants/identify")
  console.log("  GET  /api/plants/scans")
  console.log("  GET  /api/plants/stats")
  console.log("  GET  /api/health")
})
