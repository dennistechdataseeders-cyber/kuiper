const express =
  require('express');

const multer =
  require('multer');

const router =
  express.Router();

const {
  uploadCampaign
} = require(
  '../controllers/emailCampaignController'
);

const upload =
  multer({
    dest: 'uploads/'
  });

router.post(
  '/upload',
  upload.single('file'),
  uploadCampaign
);

module.exports = router;