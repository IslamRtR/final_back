const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const { validationResult } = require("express-validator")
const { pool } = require("../config/database")

// Тіркелу
console.log('JWT_SECRET loaded:', process.env.JWT_SECRET ? 'YES' : 'NO');
if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET айнымалысы табылмады!');
  process.exit(1);
}
const register = async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { fullName, email, password } = req.body

    // Қолданушы бар ма тексеру
    const existingUser = await pool.query("SELECT id FROM users WHERE email = $1", [email])
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "Бұл email мекенжайы бұрын тіркелген" })
    }

    // Құпия сөзді хэштеу
    const saltRounds = 12
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    // Жаңа қолданушыны сақтау
    const result = await pool.query(
      "INSERT INTO users (full_name, email, password) VALUES ($1, $2, $3) RETURNING id, full_name, email",
      [fullName, email, hashedPassword],
    )

    const user = result.rows[0]

    // JWT токен жасау
    // JWT токен жасау (35-жол маңында)
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" })

    res.status(201).json({
      message: "Қолданушы сәтті тіркелді",
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
      },
    })
  } catch (error) {
    console.error("Тіркелу қатесі:", error)
    res.status(500).json({ error: "Сервер қатесі" })
  }
}

// Кіру
const login = async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { email, password } = req.body

    // Қолданушыны табу
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email])
    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Қате email немесе құпия сөз" })
    }

    const user = result.rows[0]

    // Құпия сөзді тексеру
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(400).json({ error: "Қате email немесе құпия сөз" })
    }

    // JWT токен жасау
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" })

    res.json({
      message: "Сәтті кірілді",
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        avatar: user.avatar,
      },
    })
  } catch (error) {
    console.error("Кіру қатесі:", error)
    res.status(500).json({ error: "Сервер қатесі" })
  }
}

// Профильді алу
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id
    const result = await pool.query("SELECT id, full_name, email, avatar FROM users WHERE id = $1", [userId])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Қолданушы табылмады" })
    }

    const user = result.rows[0]
    res.json({
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        avatar: user.avatar,
      },
    })
  } catch (error) {
    console.error("Профиль алу қатесі:", error)
    res.status(500).json({ error: "Сервер қатесі" })
  }
}

// Профильді жаңарту
const updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const userId = req.user.id
    const { fullName, email } = req.body

    // Email ерекшелігін тексеру
    const existingUser = await pool.query("SELECT id FROM users WHERE email = $1 AND id != $2", [email, userId])
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "Бұл email мекенжайы басқа қолданушыда бар" })
    }

    // Профильді жаңарту
    const result = await pool.query(
      "UPDATE users SET full_name = $1, email = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING id, full_name, email, avatar",
      [fullName, email, userId],
    )

    const user = result.rows[0]
    res.json({
      message: "Профиль сәтті жаңартылды",
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        avatar: user.avatar,
      },
    })
  } catch (error) {
    console.error("Профиль жаңарту қатесі:", error)
    res.status(500).json({ error: "Сервер қатесі" })
  }
}

// Құпия сөзді өзгерту
const changePassword = async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const userId = req.user.id
    const { currentPassword, newPassword } = req.body

    // Ағымдағы қолданушыны алу
    const result = await pool.query("SELECT password FROM users WHERE id = $1", [userId])
    const user = result.rows[0]

    // Ағымдағы құпия сөзді тексеру
    const isMatch = await bcrypt.compare(currentPassword, user.password)
    if (!isMatch) {
      return res.status(400).json({ error: "Ағымдағы құпия сөз қате" })
    }

    // Жаңа құпия сөзді хэштеу
    const saltRounds = 12
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds)

    // Құпия сөзді жаңарту
    await pool.query("UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [
      hashedPassword,
      userId,
    ])

    res.json({ message: "Құпия сөз сәтті өзгертілді" })
  } catch (error) {
    console.error("Құпия сөз өзгерту қатесі:", error)
    res.status(500).json({ error: "Сервер қатесі" })
  }
}

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
}
