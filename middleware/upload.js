const multer = require("multer") // Multer кітапханасын қосу (файлдарды жүктеу үшін)
const path = require("path") // Файл жолдарымен жұмыс істеу үшін

// 📁 Файл сақтау конфигурациясы
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/") // Файлдарды "uploads/" папкасына сақтау
  },
  filename: (req, file, cb) => {
    // Бірегей атау жасау: уақыт пен кездейсоқ санды қосу
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    // Файл аты: өріс атауы (file.fieldname) және бірегей суффикс
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)) // Файлдың кеңейтімімен бірге жаңа атау
  },
})

// 📸 Файл фильтрі
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) { // Тек сурет файлдары қабылданады
    cb(null, true)
  } else {
    cb(new Error("Тек сурет файлдары ғана қабылданады"), false) // Қате хабарламасы
  }
}

// Multer конфигурациясы
const upload = multer({
  storage: storage, // Сақтау конфигурациясы
  limits: {
    fileSize: 5 * 1024 * 1024, // Максимум файл өлшемі 5MB
  },
  fileFilter: fileFilter, // Файл фильтрі
})

module.exports = upload // Мұны басқа файлдарда қолдану үшін экспорттау
