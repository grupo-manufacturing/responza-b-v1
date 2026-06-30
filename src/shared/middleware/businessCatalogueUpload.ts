import multer from 'multer'

import { CATALOGUE_MAX_FILE_SIZE_BYTES } from '../../modules/business/business.constants.js'

export const businessCatalogueUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: CATALOGUE_MAX_FILE_SIZE_BYTES,
    files: 1,
  },
})
