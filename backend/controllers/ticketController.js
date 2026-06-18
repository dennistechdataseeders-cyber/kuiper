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
  getPOCNotificationTemplate,
  getInternalOnlyTicketTemplate
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
    const { title, description, priority, projectId, feedId, isInternal, category, subcategory, subItem, ticketType } = req.body;
    
    // Determine if ticket should be internal
    const userRole = req.user.role;
    const shouldBeInternal = userRole !== 'Client' || isInternal === true;
    
    // For internal tickets, project is optional but should NOT be nullified if provided
    // For client tickets, project is required
    if (!shouldBeInternal && !projectId) {
      return res.status(400).json({ 
        error: 'Project is required for client tickets.' 
      });
    }
    
    // Keep the projectId and feedId as provided (don't nullify for internal)
    // Only nullify if they are explicitly set to null/empty string
    const finalProjectId = projectId || null;
    const finalFeedId = feedId || null;
    
    let assignedTo = null;
    
    // Try to assign from feed if provided
    if (feedId) {
      const feed = await Feed.findById(feedId).populate('assignedDevelopers', '_id');
      if (feed && feed.assignedDevelopers && feed.assignedDevelopers.length > 0) {
        assignedTo = feed.assignedDevelopers[0]._id;
      }
    }
    
    const ticket = new Ticket({
      title,
      description,
      priority,
      projectId: finalProjectId,
      feedId: finalFeedId,
      createdBy: req.user.id,
      assignedTo: assignedTo,
      isInternal: shouldBeInternal,
      category: category || '',
      subcategory: subcategory || '',
      subItem: subItem || '',
      ticketType: ticketType || ''
    });
    
    await ticket.save();
    
    // ... rest of the code remains the same ...
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ error: 'Failed to create ticket', details: error.message });
  }
};  

// Add this new template function for general tickets
function getGeneralTicketTemplate(ticket, creatorName, frontendUrl) {
  const ticketUrl = `${frontendUrl}/tickets/${ticket._id}`;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
  </style>
</head>
<body style="margin:0; padding:0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background:#f0f4f8; color:#1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f4f8; padding:48px 20px;">
    <tr>
      <td align="center">
        <table width="550" cellpadding="0" cellspacing="0" border="0" style="max-width:550px; width:100%; background:#ffffff; border-radius:24px; box-shadow:0 4px 12px rgba(0,0,0,0.05); overflow:hidden;">
          <tr>
            <td style="padding:32px 36px; border-bottom:1px solid #e2e8f0;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding-right:12px; width:38px; vertical-align: middle;">
                    <img src="https://res.cloudinary.com/dhcwcyqke/image/upload/q_auto/f_auto/v1777631279/login_img_oycuic.png" alt="KUIPER" style="width:38px; height:38px; border-radius:10px; display:block;">
                  </td>
                  <td style="vertical-align: middle;">
                    <div style="font-size:20px; font-weight:800; color:#2563eb;">KUIPER</div>
                    <div style="font-size:8px; font-weight:600; color:#94a3b8; letter-spacing:0.25em; text-transform:uppercase; margin-top:3px;">Engineered for Operations</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#f1f5f9; padding:28px 36px;">
              <div style="font-size:13px; font-weight:700; color:#475569; letter-spacing:0.06em; text-transform:uppercase;">General Support Request</div>
              <div style="font-size:26px; font-weight:800; color:#0f172a; margin-top:6px;">${ticket.ticketNumber}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 36px;">
              <div style="font-size:18px; font-weight:800; color:#0f172a; margin-bottom:20px; line-height:1.4;">${ticket.title}</div>
              <div style="background:#f8fafc; padding:20px 22px; border-radius:12px; margin-bottom:20px;">
                <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:12px;">Description</div>
                <p style="margin:0; font-size:14px; line-height:1.6; color:#334155; white-space: pre-line;">${ticket.description}</p>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px;">
                <div style="background:#f8fafc; padding:12px; border-radius:12px;">
                  <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase;">Priority</div>
                  <div style="font-size:14px; font-weight:700; color:#0f172a; margin-top:2px;">${ticket.priority}</div>
                </div>
                <div style="background:#f8fafc; padding:12px; border-radius:12px;">
                  <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase;">Category</div>
                  <div style="font-size:14px; font-weight:700; color:#0f172a; margin-top:2px;">${ticket.category || 'Support'}</div>
                </div>
              </div>
              <a href="${ticketUrl}" style="display:block; text-align:center; background:#2563eb; color:white; text-decoration:none; padding:14px; border-radius:12px; font-weight:700; font-size:13px;">
                View Ticket →
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 36px 28px 36px; text-align:center;">
              <img src="https://res.cloudinary.com/dhcwcyqke/image/upload/q_auto/f_auto/v1779973871/image_1_1_c60r0l.png" alt="KUIPER Footer" style="width:140px; max-width:60%; display:inline-block;">
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc; padding:24px 36px; text-align:center; border-radius:0 0 24px 24px;">
              <div style="font-size:10px; color:#94a3b8;">KUIPER CRM • General Support Ticket</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

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
// Update status
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Check if user can update this ticket
    const canUpdate = 
      req.user.role === 'Admin' ||
      req.user.role === 'Project Manager' ||
      ticket.createdBy.toString() === req.user.id ||  // Creator can always update
      (req.user.role === 'Developer' && ticket.assignedTo?.toString() === req.user.id);

    if (!canUpdate) {
      return res.status(403).json({ error: 'Not authorized to update this ticket' });
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