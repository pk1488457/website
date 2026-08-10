const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Ensures the target upload subfolder exists before multer tries to
// write into it, since multer itself won't create missing directories.
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const storage = (subfolder) =>
  multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, '..', 'public', 'uploads', subfolder);
      ensureDir(dir);
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      // Random filename instead of the original name - prevents path
      // traversal via crafted filenames and avoids collisions between
      // different users uploading files with the same name.
      const uniqueName = `${crypto.randomBytes(16).toString('hex')}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    },
  });

const resumeFileFilter = (req, file, cb) => {
  const allowed = ['.pdf', '.doc', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowed.includes(ext)) {
    return cb(new Error('Only PDF, DOC, and DOCX files are allowed for resumes'));
  }
  cb(null, true);
};

const imageFileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowed.includes(ext)) {
    return cb(new Error('Only JPG, PNG, and WEBP images are allowed'));
  }
  cb(null, true);
};

const maxSize = parseInt(process.env.MAX_FILE_UPLOAD, 10) || 2000000; // ~2MB default

exports.uploadResume = multer({
  storage: storage('resumes'),
  fileFilter: resumeFileFilter,
  limits: { fileSize: maxSize },
});

exports.uploadImage = multer({
  storage: storage('images'),
  fileFilter: imageFileFilter,
  limits: { fileSize: maxSize },
});

// Wraps a multer .single() call so multer's own errors (file too large,
// wrong type) come back as clean JSON through the normal error handler
// instead of multer's raw error format leaking to the client.
exports.handleUpload = (multerMiddleware) => (req, res, next) => {
  multerMiddleware(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    next();
  });
};
