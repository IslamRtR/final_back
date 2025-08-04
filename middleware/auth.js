const jwt = require("jsonwebtoken") // JWT кітапханасын қосу
const { pool } = require("../config/database") // PostgreSQL дерекқорына қосылу

// Аутентификация middleware
const auth = async (req, res, next) => {
  try {
    // Токенді алудың тәсілі: авторизация тақырыбынан "Bearer" префиксін алып тастау
    const token = req.header("Authorization")?.replace("Bearer ", "")

    if (!token) {
      // Токен болмаса, 401 қатесі қайтарылады
      return res.status(401).json({ error: "Токен табылмады, кіру рұқсаты жоқ" })
    }

    // Токенді тексеру және декодтау
    const decoded = jwt.verify(token, process.env.JWT_SECRET) // Токенді тексеру және оны декодтау
    // Декодталған мәліметтен userId алу
    const result = await pool.query("SELECT id, full_name, email, avatar FROM users WHERE id = $1", [decoded.userId])

    if (result.rows.length === 0) {
      // Егер қолданушы деректері табылмаса, 401 қатесі қайтарылады
      return res.status(401).json({ error: "Қолданушы табылмады" })
    }

    // Қолданушының мәліметтерін сұрау нәтижесімен `req.user`-ке қосу
    req.user = result.rows[0]

    next() // Кейінгі middleware немесе маршрутқа өту
  } catch (error) {
    console.error("Аутентификация қатесі:", error) // Қате туралы хабарлама
    res.status(401).json({ error: "Жарамсыз токен" }) // Егер токен жарамсыз болса, 401 қатесі
  }
}

module.exports = auth // Middleware-ді экспорттау
