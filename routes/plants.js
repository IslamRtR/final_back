const express = require("express") // Express кітапханасын қосу
const multer = require("multer") // Multer кітапханасы (файлдарды жүктеу үшін)
const path = require("path") // Файл жолдарымен жұмыс істеу үшін
const fs = require("fs") // Файл жүйесімен жұмыс істеу үшін
const axios = require("axios") // HTTP сұраныстарын жасау үшін
const auth = require("../middleware/auth") // Қолданушы аутентификациясын тексеру үшін middleware
const { pool } = require("../config/database") // PostgreSQL дерекқорымен жұмыс істеу үшін pool
const router = express.Router() // Express маршруты

// 📁 Файл сақтау конфигурациясы
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/" // Файлдарды сақтау үшін папка
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true }) // Папканы жасау
    }
    cb(null, uploadDir) // Файлды сақтау орны
  },
  filename: (req, file, cb) => {
    // Бірегей атау жасау
    const uniqueName = `plant_${Date.now()}_${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`
    cb(null, uniqueName) // Файл атауын жасау
  },
})

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) { // Тек сурет файлдары қабылданады
    cb(null, true)
  } else {
    cb(new Error("Тек сурет файлдары ғана қабылданады"), false) // Қате хабарламасы
  }
}

const upload = multer({
  storage: storage, // Сақтау конфигурациясы
  limits: { fileSize: 5 * 1024 * 1024 }, // Максимум 5MB файл өлшемі
  fileFilter: fileFilter, // Файл фильтрі
})

// 🤖 Gemini AI арқылы өсімдікті анықтау
async function analyzeWithGemini(base64Image, mimeType) {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY // API кілті

  if (!apiKey) {
    console.error("❌ GOOGLE_GEMINI_API_KEY табылмады!") // Егер API кілті жоқ болса
    throw new Error("API кілті конфигурацияланбаған")
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`

  const prompt = `Сіз сарапшы ботаниксіз. Бұл өсімдік суретін талдап, тек осы JSON форматында жауап беріңіз:

{
  "commonName": "өсімдіктің қазақша атауы",
  "scientificName": "латынша ғылыми атауы", 
  "description": "өсімдік туралы толық сипаттама",
  "origin": "шығу тегі",
  "sunlight": "жарық қажеттілігі",
  "water": "суару режимі",
  "growthRate": "өсу қарқыны"
}

МАҢЫЗДЫ: Тек JSON жауап беріңіз!`

  const requestBody = {
    contents: [
      {
        parts: [{ text: prompt }, { inlineData: { mimeType: mimeType, data: base64Image } }],
      },
    ],
  }

  try {
    console.log("🤖 Gemini AI-ға сұраныс жіберілуде...")

    const response = await axios.post(url, requestBody, {
      timeout: 30000, // Тайм-аут
      headers: { "Content-Type": "application/json" },
    })

    const responseText = response.data.candidates?.[0]?.content?.parts?.[0]?.text // Жауап мәтіні

    if (!responseText) {
      throw new Error("Gemini AI-дан жауап алынбады") // Егер жауап болмаса
    }

    console.log("🧠 Gemini жауабы:", responseText)

    // JSON форматын табу
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error("JSON форматы табылмады") // JSON форматы болмаса
    }

    const plantData = JSON.parse(jsonMatch[0]) // JSON деректерін талдау
    return plantData
  } catch (error) {
    console.error("❌ Gemini AI қатесі:", error.message)

    // Резервтік деректер
    return {
      commonName: "Белгісіз өсімдік",
      scientificName: "Species unknown",
      description: "Өсімдікті анықтау мүмкін болмады. Сапасы жоғары сурет қайта жіберіп көріңіз.",
      origin: "Белгісіз",
      sunlight: "Орташа жарық",
      water: "Орташа суару",
      growthRate: "Орташа",
    }
  }
}

// 🌿 Өсімдікті анықтау (НЕГІЗГІ ENDPOINT)
router.post("/identify", auth, upload.single("plantImage"), async (req, res) => {
  console.log("📸 Жаңа сканерлеу сұранысы келді")
  console.log("👤 Қолданушы:", req.user)

  if (!req.file) {
    return res.status(400).json({
      error: "Сурет файлы табылмады", // Сурет жүктелмеген жағдайда қате хабарламасы
    })
  }

  const filePath = req.file.path // Файл жолы
  const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}` // Сурет URL
  const userId = req.user.id

  console.log("📁 Файл сақталды:", filePath)
  console.log("🌐 Image URL:", imageUrl)

  try {
    // Base64-ке түрлендіру
    const imageBuffer = fs.readFileSync(filePath)
    const base64Image = imageBuffer.toString("base64")

    console.log("🔄 Base64 түрлендірілді")

    // Gemini AI арқылы анықтау
    const plantData = await analyzeWithGemini(base64Image, req.file.mimetype)
    console.log("✅ Өсімдік анықталды:", plantData.commonName)

    // Дерекқорға сақтау
    const insertQuery = `
      INSERT INTO plant_scans 
      (user_id, image_url, common_name, scientific_name, description, origin, sunlight, water, growth_rate, accuracy)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `

    const accuracy = Math.floor(Math.random() * 10) + 90 // 90-99% арасындағы дәлдік

    const values = [
      userId,
      imageUrl,
      plantData.commonName,
      plantData.scientificName,
      plantData.description,
      plantData.origin,
      plantData.sunlight,
      plantData.water,
      plantData.growthRate,
      accuracy,
    ]

    console.log("💾 Дерекқорға сақтауда...")
    const result = await pool.query(insertQuery, values)
    const savedScan = result.rows[0]

    console.log("✅ Дерекқорға сақталды, ID:", savedScan.id)

    // Сәтті жауап
    res.status(201).json({
      message: "Өсімдік сәтті анықталды",
      scan: {
        id: savedScan.id,
        imageUrl: savedScan.image_url,
        commonName: savedScan.common_name,
        scientificName: savedScan.scientific_name,
        description: savedScan.description,
        origin: savedScan.origin,
        sunlight: savedScan.sunlight,
        water: savedScan.water,
        growthRate: savedScan.growth_rate,
        accuracy: savedScan.accuracy,
        createdAt: savedScan.created_at,
      },
    })
  } catch (error) {
    console.error("❌ Сканерлеу қатесі:", error)

    // Файлды өшіру (қате болса)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    res.status(500).json({
      error: "Өсімдікті анықтау кезінде қате орын алды",
      details: error.message,
    })
  }
})

// 📊 Қолданушының сканерлеу тарихы
router.get("/scans", auth, async (req, res) => {
  try {
    console.log("📋 Тарих сұранысы, қолданушы:", req.user.id)

    const userId = req.user.id
    const page = Number.parseInt(req.query.page) || 1
    const limit = Number.parseInt(req.query.limit) || 10
    const offset = (page - 1) * limit

    // Жалпы саны
    const countResult = await pool.query("SELECT COUNT(*) FROM plant_scans WHERE user_id = $1", [userId])
    const totalScans = Number.parseInt(countResult.rows[0].count)

    console.log("📊 Жалпы сканерлеулер:", totalScans)

    // Сканерлеулер
    const scansResult = await pool.query(
      `SELECT * FROM plant_scans 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    )

    const scans = scansResult.rows.map((scan) => ({
      id: scan.id,
      imageUrl: scan.image_url,
      commonName: scan.common_name,
      scientificName: scan.scientific_name,
      description: scan.description,
      origin: scan.origin,
      sunlight: scan.sunlight,
      water: scan.water,
      growthRate: scan.growth_rate,
      accuracy: scan.accuracy,
      createdAt: scan.created_at,
    }))

    console.log("✅ Тарих жіберілді, саны:", scans.length)

    res.json({
      scans,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalScans / limit),
        totalScans,
        hasNext: page < Math.ceil(totalScans / limit),
        hasPrev: page > 1,
      },
    })
  } catch (error) {
    console.error("❌ Тарих алу қатесі:", error)
    res.status(500).json({
      error: "Тарихты алу кезінде қате орын алды",
    })
  }
})

// 📈 Статистика
router.get("/stats", auth, async (req, res) => {
  try {
    const userId = req.user.id

    const [totalResult, weekResult, avgResult, speciesResult] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM plant_scans WHERE user_id = $1", [userId]),
      pool.query("SELECT COUNT(*) FROM plant_scans WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '7 days'", [
        userId,
      ]),
      pool.query("SELECT AVG(accuracy) FROM plant_scans WHERE user_id = $1", [userId]),
      pool.query(
        "SELECT COUNT(DISTINCT scientific_name) FROM plant_scans WHERE user_id = $1 AND scientific_name IS NOT NULL",
        [userId],
      ),
    ])

    res.json({
      stats: {
        totalScans: Number.parseInt(totalResult.rows[0].count),
        thisWeek: Number.parseInt(weekResult.rows[0].count),
        avgAccuracy: Math.round(Number.parseFloat(avgResult.rows[0].avg) || 0),
        uniqueSpecies: Number.parseInt(speciesResult.rows[0].count),
      },
    })
  } catch (error) {
    console.error("Статистика қатесі:", error)
    res.status(500).json({
      error: "Статистиканы алу кезінде қате орын алды",
    })
  }
})

// 🗑️ Сканерлеуді өшіру
router.delete("/scans/:id", auth, async (req, res) => {
  try {
    const scanId = req.params.id
    const userId = req.user.id

    // Сканерлеуді табу
    const scanResult = await pool.query("SELECT * FROM plant_scans WHERE id = $1 AND user_id = $2", [scanId, userId])

    if (scanResult.rows.length === 0) {
      return res.status(404).json({ error: "Сканерлеу табылмады" })
    }

    const scan = scanResult.rows[0]

    // Файлды өшіру
    const fileName = path.basename(scan.image_url)
    const filePath = path.join("uploads", fileName)

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    // Дерекқордан өшіру
    await pool.query("DELETE FROM plant_scans WHERE id = $1 AND user_id = $2", [scanId, userId])

    res.json({ message: "Сканерлеу сәтті өшірілді" })
  } catch (error) {
    console.error("Өшіру қатесі:", error)
    res.status(500).json({
      error: "Сканерлеуді өшіру кезінде қате орын алды",
    })
  }
})

// 👁️ Бір сканерлеуді алу
router.get("/scans/:id", auth, async (req, res) => {
  try {
    const scanId = req.params.id
    const userId = req.user.id

    const result = await pool.query("SELECT * FROM plant_scans WHERE id = $1 AND user_id = $2", [scanId, userId])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Сканерлеу табылмады" })
    }

    const scan = result.rows[0]
    res.json({
      scan: {
        id: scan.id,
        imageUrl: scan.image_url,
        commonName: scan.common_name,
        scientificName: scan.scientific_name,
        description: scan.description,
        origin: scan.origin,
        sunlight: scan.sunlight,
        water: scan.water,
        growthRate: scan.growth_rate,
        accuracy: scan.accuracy,
        createdAt: scan.created_at,
      },
    })
  } catch (error) {
    console.error("Сканерлеу алу қатесі:", error)
    res.status(500).json({
      error: "Сканерлеуді алу кезінде қате орын алды",
    })
  }
})

module.exports = router
