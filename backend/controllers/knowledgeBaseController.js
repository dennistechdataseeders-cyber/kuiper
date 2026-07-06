const KnowledgeBase = require('../models/KnowledgeBase');
const fs = require('fs');
const path = require('path');

// Get all knowledge base entries
exports.getEntries = async (req, res) => {
  try {
    const { folder } = req.query;
    let query = {};
    if (folder) query.folder = folder;
    
    const entries = await KnowledgeBase.find(query)
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 });
    
    // Get all unique folders
    const folders = await KnowledgeBase.getFolders();
    
    res.json({
      success: true,
      entries,
      folders
    });
  } catch (error) {
    console.error('Error fetching knowledge base entries:', error);
    res.status(500).json({ error: 'Failed to fetch entries' });
  }
};

// Get single entry
exports.getEntry = async (req, res) => {
  try {
    const entry = await KnowledgeBase.findById(req.params.id)
      .populate('uploadedBy', 'name email')
      .populate('files.uploadedBy', 'name email');
    
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    
    res.json({ success: true, entry });
  } catch (error) {
    console.error('Error fetching entry:', error);
    res.status(500).json({ error: 'Failed to fetch entry' });
  }
};

// Create new entry with files
exports.createEntry = async (req, res) => {
  try {
    const { title, folder } = req.body;
    
    if (!title || !folder) {
      return res.status(400).json({ error: 'Title and folder are required' });
    }
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'At least one file is required' });
    }
    
    const fileData = req.files.map(file => ({
      url: `/uploads/knowledge/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname || file.originalName,
      size: file.size,
      mimeType: file.mimetype || file.mimeType,
      uploadedBy: req.user._id
    }));
    
    const entry = new KnowledgeBase({
      title,
      folder,
      files: fileData,
      uploadedBy: req.user._id
    });
    
    await entry.save();
    
    const populatedEntry = await KnowledgeBase.findById(entry._id)
      .populate('uploadedBy', 'name email');
    
    res.status(201).json({
      success: true,
      message: 'Entry created successfully',
      entry: populatedEntry
    });
  } catch (error) {
    console.error('Error creating entry:', error);
    res.status(500).json({ error: 'Failed to create entry' });
  }
};

// Update entry (add more files)
exports.updateEntry = async (req, res) => {
  try {
    const { title, folder } = req.body;
    const entry = await KnowledgeBase.findById(req.params.id);
    
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    
    if (title) entry.title = title;
    if (folder) entry.folder = folder;
    
    if (req.files && req.files.length > 0) {
      const fileData = req.files.map(file => ({
        url: `/uploads/knowledge/${file.filename}`,
        filename: file.filename,
        originalName: file.originalname || file.originalName,
        size: file.size,
        mimeType: file.mimetype || file.mimeType,
        uploadedBy: req.user._id
      }));
      entry.files.push(...fileData);
    }
    
    entry.updatedAt = new Date();
    await entry.save();
    
    const populatedEntry = await KnowledgeBase.findById(entry._id)
      .populate('uploadedBy', 'name email');
    
    res.json({
      success: true,
      message: 'Entry updated successfully',
      entry: populatedEntry
    });
  } catch (error) {
    console.error('Error updating entry:', error);
    res.status(500).json({ error: 'Failed to update entry' });
  }
};

// Delete entry
exports.deleteEntry = async (req, res) => {
  try {
    const entry = await KnowledgeBase.findById(req.params.id);
    
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    
    // Delete physical files from server
    const uploadDir = path.join(__dirname, '../uploads/knowledge');
    for (const file of entry.files) {
      const filePath = path.join(uploadDir, file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    await KnowledgeBase.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Entry deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting entry:', error);
    res.status(500).json({ error: 'Failed to delete entry' });
  }
};

// Delete a specific file from an entry
exports.deleteFile = async (req, res) => {
  try {
    const { entryId, fileIndex } = req.params;
    const entry = await KnowledgeBase.findById(entryId);
    
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    
    const index = parseInt(fileIndex);
    if (index < 0 || index >= entry.files.length) {
      return res.status(400).json({ error: 'Invalid file index' });
    }
    
    // Delete physical file
    const file = entry.files[index];
    const uploadDir = path.join(__dirname, '../uploads/knowledge');
    const filePath = path.join(uploadDir, file.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Remove file from entry
    entry.files.splice(index, 1);
    await entry.save();
    
    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
};

// Get all folders
exports.getFolders = async (req, res) => {
  try {
    const folders = await KnowledgeBase.getFolders();
    res.json({ success: true, folders });
  } catch (error) {
    console.error('Error fetching folders:', error);
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
};

// Download file
exports.downloadFile = async (req, res) => {
  try {
    const { entryId, fileIndex } = req.params;
    const entry = await KnowledgeBase.findById(entryId);
    
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    
    const index = parseInt(fileIndex);
    if (index < 0 || index >= entry.files.length) {
      return res.status(400).json({ error: 'Invalid file index' });
    }
    
    const file = entry.files[index];
    const uploadDir = path.join(__dirname, '../uploads/knowledge');
    const filePath = path.join(uploadDir, file.filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }
    
    // Set headers for download
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
    res.setHeader('Content-Length', file.size);
    
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    
    stream.on('error', (error) => {
      console.error('Stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to download file' });
      }
    });
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
};