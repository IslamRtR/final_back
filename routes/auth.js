const express = require("express")
const { body } = require("express-validator")
const { register, login, getProfile, updateProfile, changePassword } = require("../controllers/authController")
const auth = require("../middleware/auth")
const router = express.Router()

// Тіркелу валидациясы
const registerValidation = [
  body("fullName").trim().isLength({ min: 2 }).withMessage("Толық аты кемінде 2 таңбадан тұруы керек"),
  body("email").isEmail().normalizeEmail().withMessage("Дұрыс email мекенжайын енгізіңіз"),
  body("password").isLength({ min: 6 }).withMessage("Құпия сөз кемінде 6 таңбадан тұруы керек"),
]

// Кіру валидациясы
const loginValidation = [
  body("email").isEmail().normalizeEmail().withMessage("Дұрыс email мекенжайын енгізіңіз"),
  body("password").notEmpty().withMessage("Құпия сөзді енгізіңіз"),
]

// Профиль жаңарту валидациясы
const updateProfileValidation = [
  body("fullName").trim().isLength({ min: 2 }).withMessage("Толық аты кемінде 2 таңбадан тұруы керек"),
  body("email").isEmail().normalizeEmail().withMessage("Дұрыс email мекенжайын енгізіңіз"),
]

// Құпия сөз өзгерту валидациясы
const changePasswordValidation = [
  body("currentPassword").notEmpty().withMessage("Ағымдағы құпия сөзді енгізіңіз"),
  body("newPassword").isLength({ min: 6 }).withMessage("Жаңа құпия сөз кемінде 6 таңбадан тұруы керек"),
]

// Маршруттар
router.post("/register", registerValidation, register)
router.post("/login", loginValidation, login)
router.get("/profile", auth, getProfile)
router.put("/profile", auth, updateProfileValidation, updateProfile)
router.put("/change-password", auth, changePasswordValidation, changePassword)

module.exports = router
