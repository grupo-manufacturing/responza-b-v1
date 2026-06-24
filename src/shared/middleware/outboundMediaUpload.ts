import multer from 'multer'

import { MEDIA_MAX_FILE_SIZE_BYTES } from '../../modules/media/media.constants.js'

export const outboundMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MEDIA_MAX_FILE_SIZE_BYTES,
    files: 1,
  },
})
