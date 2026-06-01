const Ticket = require('../models/Ticket');
const Project = require('../models/Project');
const Feed = require('../models/Feed');

// Create ticket
// Create ticket
exports.createTicket = async (req, res) => {
  try {
    const { title, description, priority, projectId, feedId } = req.body;
    
    let assignedTo = null;
    
    // If feed is selected, get the assigned developers
    if (feedId) {
      const feed = await Feed.findById(feedId).populate('assignedDevelopers', '_id');
      if (feed && feed.assignedDevelopers && feed.assignedDevelopers.length > 0) {
        // Assign to the first developer in the feed (or you can assign to all)
        // For simplicity, assign to the first developer
        assignedTo = feed.assignedDevelopers[0]._id;
        
        // Optional: Store all developers in a separate field for future reference
        // ticket.assignedDevelopers = feed.assignedDevelopers.map(d => d._id);
      }
    }
    
    const ticket = new Ticket({
      title,
      description,
      priority,
      projectId,
      feedId: feedId || null,
      createdBy: req.user.id,
      assignedTo: assignedTo  // Auto-assign from feed
    });
    
    await ticket.save();
    
    // Populate references for response
    const populatedTicket = await Ticket.findById(ticket._id)
      .populate('createdBy', 'name email role')
      .populate('assignedTo', 'name email')
      .populate('projectId', 'name projectCustomId')
      .populate('feedId', 'name');
    
    // Emit socket event for real-time update
    const io = req.app.get('io');
    io.emit('ticket_created', populatedTicket);
    
    // Also notify the assigned developer
    if (assignedTo) {
      io.to(assignedTo.toString()).emit('ticket_assigned', populatedTicket);
    }
    
    res.status(201).json(populatedTicket);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
};

// Get all tickets (filtered by role)
exports.getTickets = async (req, res) => {
  try {
    let filter = {};
    const userRole = req.user.role;
    
    if (userRole === 'Client') {
      filter.createdBy = req.user.id;
    } else if (userRole === 'Developer') {
      filter.assignedTo = req.user.id;
    }
    // Admin and PM see all tickets
    
    const tickets = await Ticket.find(filter)
      .populate('createdBy', 'name email role')
      .populate('assignedTo', 'name email')
      .populate('projectId', 'name projectCustomId')
      .populate('feedId', 'name')
      .sort({ createdAt: -1 });
    
    res.json(tickets);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
};

// Get single ticket
exports.getTicketById = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('createdBy', 'name email role')
      .populate('assignedTo', 'name email')
      .populate('projectId', 'name projectCustomId')
      .populate('feedId', 'name')
      .populate('comments.userId', 'name');
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    res.json(ticket);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
};

// Update ticket status
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    ticket.status = status;
    
    if (status === 'Resolved') {
      ticket.resolvedAt = new Date();
    }
    if (status === 'Closed') {
      ticket.closedAt = new Date();
    }
    
    await ticket.save();
    
    const updatedTicket = await Ticket.findById(ticket._id)
      .populate('createdBy', 'name email role')
      .populate('assignedTo', 'name email')
      .populate('projectId', 'name projectCustomId')
      .populate('feedId', 'name');
    
    const io = req.app.get('io');
    io.emit('ticket_updated', updatedTicket);
    
    res.json(updatedTicket);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update status' });
  }
};

// Assign ticket to developer
exports.assignTicket = async (req, res) => {
  try {
    const { assignedTo } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    ticket.assignedTo = assignedTo;
    await ticket.save();
    
    const updatedTicket = await Ticket.findById(ticket._id)
      .populate('createdBy', 'name email role')
      .populate('assignedTo', 'name email')
      .populate('projectId', 'name projectCustomId')
      .populate('feedId', 'name');
    
    const io = req.app.get('io');
    io.emit('ticket_assigned', updatedTicket);
    
    res.json(updatedTicket);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to assign ticket' });
  }
};


// Add comment to ticket
exports.addComment = async (req, res) => {
  try {
    const { text, images } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    const commentData = {
      text: text || '',
      userId: req.user.id,
      userName: req.user.name,
      createdAt: new Date()
    };
    
    // Add images if provided
    if (images && images.length > 0) {
      commentData.images = images;
    }
    
    ticket.comments.push(commentData);
    await ticket.save();
    
    const updatedTicket = await Ticket.findById(ticket._id)
      .populate('createdBy', 'name email role')
      .populate('assignedTo', 'name email')
      .populate('projectId', 'name projectCustomId')
      .populate('feedId', 'name')
      .populate('comments.userId', 'name');
    
    const io = req.app.get('io');
    
    // Emit to the specific ticket room
    io.to(`ticket_${req.params.id}`).emit('ticket_commented', updatedTicket);
    
    // Also emit to the creator and assignee individually
    if (ticket.createdBy && ticket.createdBy.toString() !== req.user.id.toString()) {
      io.to(ticket.createdBy.toString()).emit('ticket_commented', updatedTicket);
    }
    
    if (ticket.assignedTo && ticket.assignedTo.toString() !== req.user.id.toString()) {
      io.to(ticket.assignedTo.toString()).emit('ticket_commented', updatedTicket);
    }
    
    res.json(updatedTicket);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
};

// Get projects for dropdown (based on role)
// Get projects for dropdown (based on role)
exports.getProjects = async (req, res) => {
  try {
    let filter = {};
    
    if (req.user.role === 'Client') {
      // For clients, filter projects where they are assigned
      const clientIdStr = req.user.id;
      
      // Use aggregation to filter projects
      const projects = await Project.aggregate([
        {
          $addFields: {
            clientIdsAsString: {
              $map: {
                input: "$clients",
                as: "client",
                in: { $toString: "$$client" }
              }
            }
          }
        },
        {
          $match: {
            $expr: {
              $in: [clientIdStr, "$clientIdsAsString"]
            }
          }
        },
        { $limit: 50 }
      ]);
      
      return res.json(projects);
    }
    
    // For other roles, return all projects
    const allProjects = await Project.find(filter)
      .select('name projectCustomId _id')
      .limit(50);
    
    res.json(allProjects);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
};

// Get feeds for dropdown
exports.getFeeds = async (req, res) => {
  try {
    const feeds = await Feed.find({ projectId: req.params.projectId })
      .select('name _id')
      .limit(50);
    
    res.json(feeds);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch feeds' });
  }
};

// Get developers for assignment dropdown
exports.getDevelopers = async (req, res) => {
  try {
    const User = require('../models/User');
    const developers = await User.find({ role: 'Developer' })
      .select('name email _id');
    
    res.json(developers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch developers' });
  }
};