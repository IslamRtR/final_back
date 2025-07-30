const jwt = require("jsonwebtoken")
const { pool } = require("../config/database")

const auth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "")

    if (!token) {
      return res.status(401).json({ error: "Токен табылмады, кіру рұқсаты жоқ" })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const result = await pool.query("SELECT id, full_name, email, avatar FROM users WHERE id = $1", [decoded.userId])

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Қолданушы табылмады" })
    }

    req.user = result.rows[0]
    next()
  } catch (error) {
    console.error("Аутентификация қатесі:", error)
    res.status(401).json({ error: "Жарамсыз токен" })
  }
}

module.exports = auth
