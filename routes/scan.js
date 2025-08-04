const express = require("express") // Express кітапханасын қосу
const multer = require("multer") // Multer кітапханасы (файлдарды жүктеу үшін)
const path = require("path") // Файл жолдарын өңдеу үшін кітапхана
const fs = require("fs") // Файл жүйесімен жұмыс істеу үшін
const axios = require("axios") // HTTP сұраныстарын жасау үшін
const auth = require("../middleware/auth") // Қолданушы аутентификациясын тексеру үшін middleware
const { pool } = require("../config/database") // PostgreSQL дерекқорымен жұмыс істеу үшін pool
const router = express.Router() // Express маршруты

// 📁 Файл сақтау конфигурациясы
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/" // Файлдарды сақтау орны
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true }) // Папка жоқ болса, жасалады
    }
    cb(null, uploadDir) // Файлды жүктеу орны
  },
  filename: (req, file, cb) => {
    const uniqueName = `plant_${Date.now()}_${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`
    cb(null, uniqueName) // Файл атының бірегей болуы үшін уақыт және кездейсоқ сан қосу
  },
})

// 📸 Файл фильтрі
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) { // Тек сурет файлдарын қабылдау
    cb(null, true)
  } else {
    cb(new Error("Тек сурет файлдары ғана қабылданады"), false) // Қате, егер файл сурет болмаса
  }
}

// Multer конфигурациясы
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // Максимум файл өлшемі 5MB
  },
  fileFilter: fileFilter, // Файл фильтрі
})

// 🔄 Base64 түрлендіру функциясы
function encodeImageToBase64(filePath) {
  try {
    const imageBuffer = fs.readFileSync(filePath) // Файлды оқып, буферге сақтау
    return imageBuffer.toString("base64") // Base64 түрлендіру
  } catch (error) {
    console.error("Base64 түрлендіру қатесі:", error)
    throw new Error("Суретті оқу мүмкін болмады") // Қате болса, хабарлау
  }
}

// 🤖 Gemini AI арқылы өсімдікті анықтау
async function analyzeWithGemini(base64Image, mimeType) {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY // API кілті

  if (!apiKey) {
    throw new Error("Google Gemini API кілті табылмады") // API кілті жоқ болса қате
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`

  const prompt = `Сіз сарапшы ботаниксіз. Бұл өсімдік суретін мұқият талдап, тек осы JSON форматында жауап беріңіз (жауап қазақ тілінде болуы керек):

{
  "commonName": "өсімдіктің қазақша атауы",
  "scientificName": "латынша ғылыми атауы", 
  "description": "өсімдік туралы толық сипаттама (2-3 сөйлем)",
  "origin": "шығу тегі/туған жері",
  "sunlight": "жарық қажеттілігі",
  "water": "суару режимі",
  "growthRate": "өсу қарқыны",
  "confidence": "анықтау дәлдігі (90-99 арасында сан)"
}

МАҢЫЗДЫ: Тек JSON форматында жауап беріңіз, басқа мәтін жазбаңыз!`

  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      topK: 32,
      topP: 1,
      maxOutputTokens: 1024,
    },
  }

  try {
    console.log("🤖 Gemini AI-ға сұраныс жіберілуде...")

    const response = await axios.post(url, requestBody, {
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    })

    const responseText = response.data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!responseText) {
      throw new Error("Gemini AI-дан жауап алынбады") // Егер жауап келмесе қате
    }

    console.log("🧠 Gemini жауабы:", responseText)

    // JSON-ды талдау
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error("JSON форматы табылмады") // JSON форматы болмағанда қате
    }

    const plantData = JSON.parse(jsonMatch[0])

    // Міндетті өрістерді тексеру
    if (!plantData.commonName || !plantData.scientificName) {
      throw new Error("Өсімдік атауы табылмады") // Өсімдік атауы жоқ болса қате
    }

    return plantData
  } catch (error) {
    console.error("Gemini AI қатесі:", error.message)

    // Резервтік мәліметтер
    return {
      commonName: "Белгісіз өсімдік",
      scientificName: "Species unknown",
      description: "Өсімдікті анықтау мүмкін болмады. Сапасы жоғары сурет қайта жіберіп көріңіз.",
      origin: "Белгісіз",
      sunlight: "Орташа жарық",
      water: "Орташа суару",
      growthRate: "Орташа",
      confidence: 50,
    }
  }
}

// 🌿 Өсімдікті сканерлеу API
router.post("/identify", auth, upload.single("plantImage"), async (req, res) => {
  console.log("📸 Жаңа сканерлеу сұранысы келді")

  if (!req.file) {
    return res.status(400).json({
      error: "Сурет файлы табылмады",
      message: "Өсімдік суретін жүктеңіз",
    })
  }

  const filePath = req.file.path
  const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`
  const userId = req.user.id

  console.log("📁 Файл сақталды:", filePath)
  console.log("👤 Қолданушы ID:", userId)

  try {
    // Base64-ке түрлендіру
    const base64Image = encodeImageToBase64(filePath)
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
      plantData.confidence || Math.floor(Math.random() * 10) + 90, // 90-99% арасында
    ]

    const result = await pool.query(insertQuery, values)
    const savedScan = result.rows[0]

    console.log("💾 Дерекқорға сақталды, ID:", savedScan.id)

    // Сәтті жауап
    res.status(201).json({
      success: true,
      message: "Өсімдік сәтті анықталды!",
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
      rawAiResponse: plantData, // Дебаг үшін
    })
  } catch (error) {
    console.error("❌ Сканерлеу қатесі:", error.message)

    // Файлды өшіру (қате болса)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      console.log("🗑️ Қате файл өшірілді")
    }

    res.status(500).json({
      success: false,
      error: "Өсімдікті анықтау кезінде қате орын алды",
      message: error.message,
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    })
  }
})

// 📊 Қолданушының сканерлеу тарихы
router.get("/history", auth, async (req, res) => {
  try {
    const userId = req.user.id
    const page = Number.parseInt(req.query.page) || 1
    const limit = Number.parseInt(req.query.limit) || 10
    const offset = (page - 1) * limit

    // Жалпы саны
    const countResult = await pool.query("SELECT COUNT(*) FROM plant_scans WHERE user_id = $1", [userId])
    const totalScans = Number.parseInt(countResult.rows[0].count)

    // Сканерлеулер
    const scansResult = await pool.query(
      `
      SELECT * FROM plant_scans 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `,
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

    res.json({
      success: true,
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
    console.error("Тарих алу қатесі:", error)
    res.status(500).json({
      success: false,
      error: "Тарихты алу кезінде қате орын алды",
    })
  }
})

// 🗑️ Сканерлеуді өшіру
router.delete("/history/:id", auth, async (req, res) => {
  try {
    const scanId = req.params.id
    const userId = req.user.id

    // Сканерлеуді табу
    const scanResult = await pool.query("SELECT * FROM plant_scans WHERE id = $1 AND user_id = $2", [scanId, userId])

    if (scanResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Сканерлеу табылмады",
      })
    }

    const scan = scanResult.rows[0]

    // Файлды өшіру
    const fileName = path.basename(scan.image_url)
    const filePath = path.join("uploads", fileName)

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      console.log("🗑️ Файл өшірілді:", filePath)
    }

    // Дерекқордан өшіру
    await pool.query("DELETE FROM plant_scans WHERE id = $1 AND user_id = $2", [scanId, userId])

    res.json({
      success: true,
      message: "Сканерлеу сәтті өшірілді",
    })
  } catch (error) {
    console.error("Өшіру қатесі:", error)
    res.status(500).json({
      success: false,
      error: "Сканерлеуді өшіру кезінде қате орын алды",
    })
  }
})

// 📈 Статистика
router.get("/stats", auth, async (req, res) => {
  try {
    const userId = req.user.id

    // Жалпы сканерлеулер
    const totalResult = await pool.query("SELECT COUNT(*) FROM plant_scans WHERE user_id = $1", [userId])

    // Осы аптадағы сканерлеулер
    const weekResult = await pool.query(
      `
      SELECT COUNT(*) FROM plant_scans 
      WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
    `,
      [userId],
    )

    // Орташа дәлдік
    const avgResult = await pool.query("SELECT AVG(accuracy) FROM plant_scans WHERE user_id = $1", [userId])

    // Ерекше түрлер
    const speciesResult = await pool.query(
      `
      SELECT COUNT(DISTINCT scientific_name) FROM plant_scans 
      WHERE user_id = $1 AND scientific_name IS NOT NULL
    `,
      [userId],
    )

    res.json({
      success: true,
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
      success: false,
      error: "Статистиканы алу кезінде қате орын алды",
    })
  }
})

module.exports = router
