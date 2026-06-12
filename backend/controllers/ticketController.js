// backend/controllers/ticketController.js

const Ticket = require('../models/Ticket');
const Project = require('../models/Project');
const Feed = require('../models/Feed');
const User = require('../models/User');
const Organization = require('../models/Organization');
const sendEmail = require('../services/zohoMailer');
const {
  getTicketCreatedTemplate,
  getInternalTicketTemplate,
  getPOCNotificationTemplate
} = require('../templates/ticketEmailTemplates');

// Helper function to get all stakeholders for a ticket
async function getTicketStakeholders(ticket, createdByUser) {
  const stakeholders = new Map(); // Use Map to avoid duplicates by email

  // 1. Add the created by user
  if (createdByUser) {
    stakeholders.set(createdByUser.email, {
      name: createdByUser.name,
      email: createdByUser.email,
      role: createdByUser.role,
      type: 'creator'
    });
  }

  // 2. Add assigned developer if exists
  if (ticket.assignedTo) {
    const assignee = await User.findById(ticket.assignedTo).select('name email role');
    if (assignee) {
      stakeholders.set(assignee.email, {
        name: assignee.name,
        email: assignee.email,
        role: assignee.role,
        type: 'assignee'
      });
    }
  }

  // 3. Get project details
  const project = await Project.findById(ticket.projectId)
    .populate('projectManager', 'name email role')
    .populate('clients', 'name email role');

  // 4. Add Project Manager
  if (project && project.projectManager) {
    const pm = project.projectManager;
    stakeholders.set(pm.email, {
      name: pm.name,
      email: pm.email,
      role: 'Project Manager',
      type: 'project_manager'
    });
  }

  // 5. Add POC (Client) users from the project
  if (project && project.clients && project.clients.length > 0) {
    for (const client of project.clients) {
      const clientUser = await User.findById(client._id || client).select('name email role organizationId');
      if (clientUser) {
        // If ticket is created by a Client, don't email them again (they already got a confirmation)
        const isCreator = clientUser._id.toString() === createdByUser?._id.toString();
        
        if (!isCreator) {
          stakeholders.set(clientUser.email, {
            name: clientUser.name,
            email: clientUser.email,
            role: 'POC',
            type: 'poc'
          });
        }
      }
    }
  }

  // 6. Also get POCs from organizations associated with the project
  if (project && project.organizations && project.organizations.length > 0) {
    for (const orgId of project.organizations) {
      const org = await Organization.findById(orgId).select('pointsOfContact clientUserId');
      if (org) {
        // Get client user associated with organization
        if (org.clientUserId) {
          const clientUser = await User.findById(org.clientUserId).select('name email role');
          if (clientUser && clientUser.email !== createdByUser?.email) {
            stakeholders.set(clientUser.email, {
              name: clientUser.name,
              email: clientUser.email,
              role: 'POC',
              type: 'poc'
            });
          }
        }
        
        // Also add all points of contact
        if (org.pointsOfContact && org.pointsOfContact.length > 0) {
          for (const poc of org.pointsOfContact) {
            if (poc.pocEmail && poc.pocEmail !== createdByUser?.email) {
              stakeholders.set(poc.pocEmail, {
                name: poc.pocName,
                email: poc.pocEmail,
                role: 'POC',
                type: 'poc'
              });
            }
          }
        }
      }
    }
  }

  // 7. Add developers assigned to the feed (if feed exists)
  if (ticket.feedId) {
    const feed = await Feed.findById(ticket.feedId).populate('assignedDevelopers', 'name email role');
    if (feed && feed.assignedDevelopers && feed.assignedDevelopers.length > 0) {
      for (const dev of feed.assignedDevelopers) {
        if (dev.email !== createdByUser?.email) {
          stakeholders.set(dev.email, {
            name: dev.name,
            email: dev.email,
            role: 'Developer',
            type: 'developer'
          });
        }
      }
    }
  }

  return Array.from(stakeholders.values());
}

// Helper function to send comment notifications
async function notifyCommentStakeholders(ticket, commentAuthor, commentText, hasImages) {
  const project = await Project.findById(ticket.projectId)
    .populate('projectManager', 'name email')
    .populate('clients', 'name email');
  
  const stakeholders = new Map();
  
  // Add creator
  const creator = await User.findById(ticket.createdBy).select('name email');
  if (creator && creator.email !== commentAuthor.email) {
    stakeholders.set(creator.email, { 
      name: creator.name, 
      email: creator.email, 
      role: 'Creator' 
    });
  }
  
  // Add assignee
  if (ticket.assignedTo) {
    const assignee = await User.findById(ticket.assignedTo).select('name email');
    if (assignee && assignee.email !== commentAuthor.email) {
      stakeholders.set(assignee.email, { 
        name: assignee.name, 
        email: assignee.email, 
        role: 'Assignee' 
      });
    }
  }
  
  // Add project manager
  if (project && project.projectManager && project.projectManager.email !== commentAuthor.email) {
    stakeholders.set(project.projectManager.email, {
      name: project.projectManager.name,
      email: project.projectManager.email,
      role: 'Project Manager'
    });
  }
  
  // Also add feed developers
  if (ticket.feedId) {
    const feed = await Feed.findById(ticket.feedId).populate('assignedDevelopers', 'name email');
    if (feed && feed.assignedDevelopers && feed.assignedDevelopers.length > 0) {
      for (const dev of feed.assignedDevelopers) {
        if (dev.email !== commentAuthor.email && !stakeholders.has(dev.email)) {
          stakeholders.set(dev.email, {
            name: dev.name,
            email: dev.email,
            role: 'Developer'
          });
        }
      }
    }
  }
  
  // Send emails
  const commentPreview = commentText.length > 100 ? commentText.substring(0, 100) + '...' : commentText;
  const imageText = hasImages ? ` 📷 +${hasImages} image(s)` : '';
  const frontendUrl = process.env.FRONTEND_URL || 'http://192.168.1.105:5173';
  
  for (const stakeholder of stakeholders.values()) {
    try {
      const commentUrl = `${frontendUrl}/tickets/${ticket._id}`;
      
      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="margin:0; padding:40px; font-family: 'Segoe UI', Arial, sans-serif; background:#f8fafc;">
<div style="max-width:550px; margin:auto; background:white; border-radius:20px; border:1px solid #e2e8f0;">
  <div style="background:#f59e0b; padding:20px; text-align:center;">
    <h2 style="margin:0; font-size:18px; color:white;">💬 New Comment on Ticket</h2>
  </div>
  <div style="padding:24px;">
    <p style="margin-bottom:16px;"><strong>${commentAuthor.name}</strong> commented on <strong>${ticket.ticketNumber}</strong>${imageText}:</p>
    <div style="background:#fef3c7; padding:16px; border-radius:12px; margin:16px 0;">
      <p style="margin:0; color:#92400e;">"${commentPreview.replace(/</g, '&lt;').replace(/>/g, '&gt;')}"</p>
    </div>
    <div style="margin:20px 0; padding:12px; background:#f8fafc; border-radius:12px;">
      <p style="margin:0; font-size:12px; font-weight:600; color:#1e293b;">Ticket: ${ticket.title}</p>
      <p style="margin:4px 0 0 0; font-size:11px; color:#64748b;">Status: ${ticket.status} | Priority: ${ticket.priority}</p>
    </div>
    <a href="${commentUrl}" style="display:block; text-align:center; background:#f59e0b; color:white; text-decoration:none; padding:12px; border-radius:12px; font-weight:700; font-size:13px;">
      View Comment →
    </a>
  </div>
</div>
</body>
</html>
      `;
      
      await sendEmail({
        to: stakeholder.email,
        subject: `💬 New Comment on ${ticket.ticketNumber}`,
        html: emailHtml
      });
      
      console.log(`   📧 Comment notification sent to: ${stakeholder.email}`);
    } catch (err) {
      console.error(`   ❌ Failed to send comment email to ${stakeholder.email}:`, err.message);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

// Determine if this is an internal ticket (PM/Admin/Developer created)
function isInternalTicket(creatorRole) {
  return ['Admin', 'Project Manager', 'Developer'].includes(creatorRole);
}

// Create ticket
exports.createTicket = async (req, res) => {
  try {
    const { title, description, priority, projectId, feedId } = req.body;
    
    let assignedTo = null;
    
    // If feed is selected, get the assigned developers
    if (feedId) {
      const feed = await Feed.findById(feedId).populate('assignedDevelopers', '_id');
      if (feed && feed.assignedDevelopers && feed.assignedDevelopers.length > 0) {
        // Assign to the first developer in the feed
        assignedTo = feed.assignedDevelopers[0]._id;
      }
    }
    
    const ticket = new Ticket({
      title,
      description,
      priority,
      projectId,
      feedId: feedId || null,
      createdBy: req.user.id,
      assignedTo: assignedTo
    });
    
    await ticket.save();
    
    // Populate references for response
    const populatedTicket = await Ticket.findById(ticket._id)
      .populate('createdBy', 'name email role')
      .populate('assignedTo', 'name email')
      .populate('projectId', 'name projectCustomId')
      .populate('feedId', 'name');
    
    // ============================================
    // EMAIL NOTIFICATIONS
    // ============================================
    
    const createdByUser = await User.findById(req.user.id).select('name email role');
    const isInternal = isInternalTicket(createdByUser.role);
    
    // Get all stakeholders who should be notified
    const stakeholders = await getTicketStakeholders(populatedTicket, createdByUser);
    
    console.log(`📧 Sending ticket notifications for ${populatedTicket.ticketNumber}`);
    console.log(`   Ticket Type: ${isInternal ? 'INTERNAL' : 'EXTERNAL'}`);
    console.log(`   Created By: ${createdByUser.name} (${createdByUser.role})`);
    console.log(`   Recipients: ${stakeholders.length} stakeholders`);
    
    const frontendUrl = process.env.FRONTEND_URL || 'http://192.168.1.105:5173';
    
    // Send emails to all stakeholders
    for (const stakeholder of stakeholders) {
      try {
        let emailHtml;
        let emailSubject;
        
        if (isInternal) {
          // Internal ticket - simpler notification (no POC emails for internal tickets)
          // Skip if stakeholder is a POC (only notify internal team)
          if (stakeholder.type === 'poc') {
            console.log(`   ⏭️ Skipping POC ${stakeholder.email} for internal ticket`);
            continue;
          }
          
          emailHtml = getInternalTicketTemplate(
            populatedTicket,
            createdByUser.name,
            stakeholders,
            frontendUrl
          );
          emailSubject = `[Internal] New Task: ${populatedTicket.ticketNumber} - ${title.substring(0, 60)}`;
        } else {
          // External ticket - created by POC/Client
          if (stakeholder.type === 'poc' && stakeholder.role === 'POC') {
            // POC gets a customer-friendly notification
            emailHtml = getPOCNotificationTemplate(
              populatedTicket,
              stakeholder.name,
              populatedTicket.projectId?.name || 'your project',
              frontendUrl
            );
            emailSubject = `Support Request Received: ${populatedTicket.ticketNumber}`;
          } else {
            // Internal team members get full ticket details
            emailHtml = getTicketCreatedTemplate(
              populatedTicket,
              createdByUser.name,
              stakeholders,
              frontendUrl
            );
            emailSubject = `[Ticket] ${populatedTicket.ticketNumber}: ${title.substring(0, 60)}`;
          }
        }
        
        await sendEmail({
          to: stakeholder.email,
          subject: emailSubject,
          html: emailHtml
        });
        
        console.log(`   ✅ Email sent to: ${stakeholder.email} (${stakeholder.role})`);
        
      } catch (emailError) {
        console.error(`   ❌ Failed to send email to ${stakeholder.email}:`, emailError.message);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
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
    
    // Send email notifications for comments (except self)
    await notifyCommentStakeholders(
      updatedTicket,
      { name: req.user.name, email: req.user.email },
      text || '',
      images?.length || 0
    );
    
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