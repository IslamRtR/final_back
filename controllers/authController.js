const bcrypt = require("bcryptjs") // bcryptjs кітапханасы, құпия сөздерді хэштеу үшін
const jwt = require("jsonwebtoken") // JWT кітапханасы, токен жасау үшін
const { validationResult } = require("express-validator") // express-validator кітапханасы, деректерді тексеру үшін
const { pool } = require("../config/database") // PostgreSQL дерекқорын басқару үшін pool

// Тіркелу
console.log('JWT_SECRET loaded:', process.env.JWT_SECRET ? 'YES' : 'NO'); 
if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET айнымалысы табылмады!');
  process.exit(1); // JWT_SECRET болмаса, серверді тоқтату
}
const register = async (req, res) => {
  try {
    const errors = validationResult(req) // Өткізілген деректерді тексеру
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() }) // Егер қате болса, 400 статусымен жіберу
    }

    const { fullName, email, password } = req.body // Тіркелу үшін енгізілген мәліметтер

    // Қолданушы бар ма тексеру
    const existingUser = await pool.query("SELECT id FROM users WHERE email = $1", [email])
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "Бұл email мекенжайы бұрын тіркелген" }) // Егер email тіркелген болса
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
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" }) // Токен жасау

    res.status(201).json({
      message: "Қолданушы сәтті тіркелді",
      token, // Токенді клиентке қайтару
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
      },
    })
  } catch (error) {
    console.error("Тіркелу қатесі:", error)
    res.status(500).json({ error: "Сервер қатесі" }) // Егер серверде қате болса
  }
}

// Кіру
const login = async (req, res) => {
  try {
    const errors = validationResult(req) // Өткізілген деректерді тексеру
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() }) // Егер қате болса, 400 статусымен жіберу
    }

    const { email, password } = req.body // Кіру үшін енгізілген мәліметтер

    // Қолданушыны табу
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email])
    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Қате email немесе құпия сөз" }) // Егер қолданушы табылмаса
    }

    const user = result.rows[0]

    // Құпия сөзді тексеру
    const isMatch = await bcrypt.compare(password, user.password) // bcrypt арқылы құпия сөзді тексеру
    if (!isMatch) {
      return res.status(400).json({ error: "Қате email немесе құпия сөз" }) // Құпия сөз сәйкес келмесе
    }

    // JWT токен жасау
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" }) // Токен жасау

    res.json({
      message: "Сәтті кірілді",
      token, // Токенді клиентке қайтару
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        avatar: user.avatar,
      },
    })
  } catch (error) {
    console.error("Кіру қатесі:", error)
    res.status(500).json({ error: "Сервер қатесі" }) // Егер серверде қате болса
  }
}

// Профильді алу
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id // Қолданушының идентификаторы
    const result = await pool.query("SELECT id, full_name, email, avatar FROM users WHERE id = $1", [userId])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Қолданушы табылмады" }) // Егер қолданушы табылмаса
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
    res.status(500).json({ error: "Сервер қатесі" }) // Егер серверде қате болса
  }
}

// Профильді жаңарту
const updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req) // Өткізілген деректерді тексеру
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() }) // Егер қате болса, 400 статусымен жіберу
    }

    const userId = req.user.id
    const { fullName, email } = req.body // Профильді жаңартуға арналған мәліметтер

    // Email ерекшелігін тексеру
    const existingUser = await pool.query("SELECT id FROM users WHERE email = $1 AND id != $2", [email, userId])
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "Бұл email мекенжайы басқа қолданушыда бар" }) // Егер email басқа қолданушыда болса
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
    res.status(500).json({ error: "Сервер қатесі" }) // Егер серверде қате болса
  }
}

// Құпия сөзді өзгерту
const changePassword = async (req, res) => {
  try {
    const errors = validationResult(req) // Өткізілген деректерді тексеру
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() }) // Егер қате болса, 400 статусымен жіберу
    }

    const userId = req.user.id
    const { currentPassword, newPassword } = req.body // Ағымдағы және жаңа құпия сөздер

    // Ағымдағы қолданушыны алу
    const result = await pool.query("SELECT password FROM users WHERE id = $1", [userId])
    const user = result.rows[0]

    // Ағымдағы құпия сөзді тексеру
    const isMatch = await bcrypt.compare(currentPassword, user.password) // bcrypt арқылы ағымдағы құпия сөзді тексеру
    if (!isMatch) {
      return res.status(400).json({ error: "Ағымдағы құпия сөз қате" }) // Егер ағымдағы құпия сөз дұрыс болмаса
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
    res.status(500).json({ error: "Сервер қатесі" }) // Егер серверде қате болса
  }
}

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
}
