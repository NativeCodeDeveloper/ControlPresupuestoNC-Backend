import multer from 'multer';

const ALLOWED_MIME = new Set([
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv', 'text/markdown', 'text/x-markdown',
    'text/x-sh', 'application/x-sh', 'application/x-shellscript',
    'application/json',
    'application/zip', 'application/x-zip-compressed',
]);

const fileFilter = (req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`));
};

// Memoria en lugar de disco — el buffer se sube directo a R2
export const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter,
    limits: { fileSize: 20 * 1024 * 1024 },
});
