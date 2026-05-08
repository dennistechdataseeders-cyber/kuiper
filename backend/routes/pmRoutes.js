const express = require('express');
const router = express.Router();
const { getAllProjects, createProject } = require('../controllers/projectController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleCheck'); 

router.use(protect);

// FIXED: Added the space to match "Project Manager" in your database
router.use(authorize('Admin', 'Project Manager','Sales', 'Sales Manager')); 

router.get('/projects', getAllProjects);
router.post('/projects', createProject);

module.exports = router;