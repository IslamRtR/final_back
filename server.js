const express = require("express")
const cors = require("cors")
const path = require("path")
const rateLimit = require("express-rate-limit")
require("dotenv").config()

const { createTables } = require("./config/database")
const authRoutes = require("./routes/auth")
const plantsRoutes = require("./routes/plants") // plants.js файлын пайдалану

const app = express()
const PORT = process.env.PORT || 5002

// Дерекқор кестелерін жасау
createTables()

// Uploads папкасын жасау
const fs = require("fs")
const uploadsDir = "uploads"
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir)
  console.log("📁 Uploads папкасы жасалды")
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // Максимум 100 сұраныс
})

// Middleware
app.use(limiter)
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  }),
)
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// Статикалық файлдар
app.use("/uploads", express.static("uploads"))

// Маршруттар
app.use("/api/auth", authRoutes)
app.use("/api/plants", plantsRoutes) // /api/plants маршруты

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  })
})

// Қате өңдеу middleware
app.use((error, req, res, next) => {
  console.error("🚨 Сервер қатесі:", error)

  if (error.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "Файл өлшемі тым үлкен (максимум 5MB)" })
  }

  if (error.message === "Тек сурет файлдары ғана қабылданады") {
    return res.status(400).json({ error: error.message })
  }

  res.status(500).json({
    error: "Сервер қатесі",
    details: process.env.NODE_ENV === "development" ? error.message : undefined,
  })
})

// 404 қатесі
app.use("*", (req, res) => {
  console.log(`❌ 404: ${req.method} ${req.originalUrl}`)
  res.status(404).json({ error: "API endpoint табылмады" })
})
app.get("/", (req, res) => {
  res.send("Plant Identification API")
})
// Сервер іске қосу
app.listen(PORT, () => {
  console.log(`🚀 Сервер ${PORT} портында іске қосылды`)
  console.log(`📁 API мекенжайы: http://localhost:${PORT}`)
  console.log(`🌐 CORS: ${process.env.CLIENT_URL || "http://localhost:5173"}`)
  console.log(`🤖 Gemini API: ${process.env.GOOGLE_GEMINI_API_KEY ? "ҚОСЫЛҒАН ✅" : "ҚОСЫЛМАҒАН ❌"}`)
  console.log(`💾 JWT Secret: ${process.env.JWT_SECRET ? "ҚОСЫЛҒАН ✅" : "ҚОСЫЛМАҒАН ❌"}`)

  // Available endpoints
  console.log("\n📋 Қолжетімді API endpoints:")
  console.log("  POST /api/auth/register")
  console.log("  POST /api/auth/login")
  console.log("  GET  /api/auth/profile")
  console.log("  POST /api/plants/identify")
  console.log("  GET  /api/plants/scans")
  console.log("  GET  /api/plants/stats")
  console.log("  GET  /api/health")
})
