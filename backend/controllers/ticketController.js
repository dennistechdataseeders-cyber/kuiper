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

// ============================================
// NOTIFICATION HELPER FUNCTIONS
// ============================================

async function createNotification(userId, notificationData) {
  try {
    const user = await User.findById(userId);
    if (!user) return;
    
    if (!user.unreadNotifications) {
      user.unreadNotifications = [];
    }
    
    let message = notificationData.message;
    if (notificationData.type === 'ticket_commented' && notificationData.commentAuthor) {
      message = `${notificationData.commentAuthor} commented on ${notificationData.ticketNumber || 'ticket'}`;
      if (notificationData.hasAttachments) {
        const parts = [];
        if (notificationData.hasImages) parts.push('📷 images');
        if (notificationData.hasFiles) parts.push('📎 files');
        if (parts.length > 0) {
          message += ` (with ${parts.join(' & ')})`;
        }
      }
    }
    
    user.unreadNotifications.push({
      type: notificationData.type || 'ticket_created',
      ticketId: notificationData.ticketId,
      message: message,
      createdAt: new Date(),
      read: false
    });
    
    user.notificationCount = (user.notificationCount || 0) + 1;
    await user.save();
    
    const io = global.io;
    if (io) {
      io.to(userId.toString()).emit('notification_count_update', {
        type: notificationData.type,
        ticketId: notificationData.ticketId,
        count: user.notificationCount,
        message: message,
        comment: notificationData.commentData || null
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error creating notification:', error);
    return false;
  }
}

// ============================================
// STAKEHOLDER HELPER FUNCTIONS
// ============================================

async function getTicketStakeholders(ticket, createdByUser) {
  const stakeholders = new Map();

  if (createdByUser) {
    stakeholders.set(createdByUser.email, {
      _id: createdByUser._id,
      name: createdByUser.name,
      email: createdByUser.email,
      role: createdByUser.role,
      type: 'creator'
    });
  }

  if (ticket.assignedTo) {
    const assignee = await User.findById(ticket.assignedTo).select('name email role');
    if (assignee) {
      stakeholders.set(assignee.email, {
        _id: assignee._id,
        name: assignee.name,
        email: assignee.email,
        role: assignee.role,
        type: 'assignee'
      });
    }
  }

  const project = await Project.findById(ticket.projectId)
    .populate('projectManager', 'name email role')
    .populate('teamLead', 'name email role')
    .populate('clients', 'name email role');

  if (project && project.projectManager) {
    const pm = project.projectManager;
    if (!stakeholders.has(pm.email)) {
      stakeholders.set(pm.email, {
        _id: pm._id,
        name: pm.name,
        email: pm.email,
        role: 'Project Manager',
        type: 'project_manager'
      });
    }
  }

  if (project && project.teamLead) {
    const tl = project.teamLead;
    if (!stakeholders.has(tl.email)) {
      stakeholders.set(tl.email, {
        _id: tl._id,
        name: tl.name,
        email: tl.email,
        role: 'Team Lead',
        type: 'team_lead'
      });
    }
  }

  if (ticket.feedId) {
    const feed = await Feed.findById(ticket.feedId).populate('assignedDevelopers', 'name email role');
    if (feed && feed.assignedDevelopers && feed.assignedDevelopers.length > 0) {
      for (const dev of feed.assignedDevelopers) {
        if (!stakeholders.has(dev.email)) {
          stakeholders.set(dev.email, {
            _id: dev._id,
            name: dev.name,
            email: dev.email,
            role: 'Developer',
            type: 'developer'
          });
        }
      }
    }
  }

  if (project && project.clients && project.clients.length > 0) {
    for (const client of project.clients) {
      const clientUser = await User.findById(client._id || client).select('name email role organizationId');
      if (clientUser) {
        const isCreator = clientUser._id.toString() === createdByUser?._id.toString();
        if (!isCreator && !stakeholders.has(clientUser.email)) {
          stakeholders.set(clientUser.email, {
            _id: clientUser._id,
            name: clientUser.name,
            email: clientUser.email,
            role: 'POC',
            type: 'poc'
          });
        }
      }
    }
  }

  if (project && project.organizations && project.organizations.length > 0) {
    for (const orgId of project.organizations) {
      const org = await Organization.findById(orgId).select('pointsOfContact clientUserId');
      if (org) {
        if (org.clientUserId) {
          const clientUser = await User.findById(org.clientUserId).select('name email role');
          if (clientUser && !stakeholders.has(clientUser.email)) {
            const isCreator = clientUser._id.toString() === createdByUser?._id.toString();
            if (!isCreator) {
              stakeholders.set(clientUser.email, {
                _id: clientUser._id,
                name: clientUser.name,
                email: clientUser.email,
                role: 'POC',
                type: 'poc'
              });
            }
          }
        }
        
        if (org.pointsOfContact && org.pointsOfContact.length > 0) {
          for (const poc of org.pointsOfContact) {
            if (poc.pocEmail && !stakeholders.has(poc.pocEmail)) {
              const isCreator = poc.pocEmail === createdByUser?.email;
              if (!isCreator) {
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
  }

  return Array.from(stakeholders.values());
}

async function getAssigneeEmailFromRules(category, subcategory = '', subItem = '') {
  try {
    const TicketAssignmentRule = require('../models/TicketAssignmentRule');
    
    const rule = await TicketAssignmentRule.findBestMatch(category, subcategory, subItem);
    
    if (rule) {
      console.log(`✅ Found assignment rule for ${category}/${subcategory}/${subItem}: ${rule.assigneeEmail}`);
      return {
        email: rule.assigneeEmail,
        name: rule.assigneeName || rule.assigneeEmail,
        ruleId: rule._id
      };
    }
    
    console.log(`⚠️ No rule found for ${category}/${subcategory}/${subItem}, using default`);
    return {
      email: process.env.DEFAULT_TICKET_EMAIL || 'admin@yourcompany.com',
      name: 'Default Support',
      ruleId: null
    };
  } catch (error) {
    console.error('Error fetching assignment rule:', error);
    return {
      email: process.env.DEFAULT_TICKET_EMAIL || 'admin@yourcompany.com',
      name: 'Default Support',
      ruleId: null
    };
  }
}

async function notifyCommentStakeholders(ticket, commentAuthor, commentText, hasImages = false, hasFiles = false) {
  const project = await Project.findById(ticket.projectId)
    .populate('projectManager', 'name email')
    .populate('teamLead', 'name email')
    .populate('clients', 'name email');
  
  const stakeholders = new Map();
  
  const creator = await User.findById(ticket.createdBy).select('name email');
  if (creator && creator.email !== commentAuthor.email) {
    stakeholders.set(creator._id.toString(), { 
      _id: creator._id,
      name: creator.name, 
      email: creator.email, 
      role: 'Creator' 
    });
  }
  
  if (ticket.assignedTo) {
    const assignee = await User.findById(ticket.assignedTo).select('name email');
    if (assignee && assignee.email !== commentAuthor.email) {
      stakeholders.set(assignee._id.toString(), { 
        _id: assignee._id,
        name: assignee.name, 
        email: assignee.email, 
        role: 'Assignee' 
      });
    }
  }
  
  if (project && project.projectManager && project.projectManager.email !== commentAuthor.email) {
    stakeholders.set(project.projectManager._id.toString(), {
      _id: project.projectManager._id,
      name: project.projectManager.name,
      email: project.projectManager.email,
      role: 'Project Manager'
    });
  }
  
  if (project && project.teamLead && project.teamLead.email !== commentAuthor.email) {
    stakeholders.set(project.teamLead._id.toString(), {
      _id: project.teamLead._id,
      name: project.teamLead.name,
      email: project.teamLead.email,
      role: 'Team Lead'
    });
  }
  
  if (ticket.feedId) {
    const feed = await Feed.findById(ticket.feedId).populate('assignedDevelopers', 'name email');
    if (feed && feed.assignedDevelopers && feed.assignedDevelopers.length > 0) {
      for (const dev of feed.assignedDevelopers) {
        if (dev.email !== commentAuthor.email && !stakeholders.has(dev._id.toString())) {
          stakeholders.set(dev._id.toString(), {
            _id: dev._id,
            name: dev.name,
            email: dev.email,
            role: 'Developer'
          });
        }
      }
    }
  }
  
  const frontendUrl = process.env.FRONTEND_URL || 'http://192.168.1.105:5173';
  const commentPreview = commentText ? commentText.substring(0, 200) : 'No text provided';
  const hasAttachments = hasImages || hasFiles;
  
  let attachmentText = '';
  if (hasAttachments) {
    const parts = [];
    if (hasImages) parts.push('📷 images');
    if (hasFiles) parts.push('📎 files');
    attachmentText = ` (with ${parts.join(' & ')})`;
  }
  
  for (const [userId, stakeholder] of stakeholders) {
    try {
      const user = await User.findById(userId);
      if (!user) continue;
      
      if (!user.unreadNotifications) {
        user.unreadNotifications = [];
      }
      
      const message = `${commentAuthor.name} commented on ${ticket.ticketNumber}${attachmentText}`;
      
      user.unreadNotifications.push({
        type: 'ticket_commented',
        ticketId: ticket._id,
        message: message,
        createdAt: new Date(),
        read: false,
        commentData: {
          text: commentPreview,
          author: commentAuthor.name,
          hasAttachments: hasAttachments,
          hasImages: hasImages,
          hasFiles: hasFiles,
          timestamp: new Date()
        }
      });
      
      user.notificationCount = (user.notificationCount || 0) + 1;
      await user.save();
      
      const io = global.io;
      if (io) {
        io.to(userId.toString()).emit('notification_count_update', {
          type: 'ticket_commented',
          ticketId: ticket._id,
          count: user.notificationCount,
          message: message,
          comment: {
            text: commentPreview,
            author: commentAuthor.name,
            hasAttachments: hasAttachments,
            ticketNumber: ticket.ticketNumber,
            ticketTitle: ticket.title
          }
        });
        
        io.to(`ticket_${ticket._id}`).emit('ticket_commented', {
          ticketId: ticket._id,
          comment: {
            text: commentPreview,
            author: commentAuthor.name,
            hasAttachments: hasAttachments
          }
        });
      }
      
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
  <div style="background:#7c3aed; padding:20px; text-align:center;">
    <h2 style="margin:0; font-size:18px; color:white;">💬 New Comment on Ticket</h2>
  </div>
  <div style="padding:24px;">
    <p style="margin-bottom:16px;"><strong>${commentAuthor.name}</strong> commented on <strong>${ticket.ticketNumber}</strong>${attachmentText}:</p>
    <div style="background:#f3e8ff; padding:16px; border-radius:12px; margin:16px 0;">
      <p style="margin:0; color:#6d28d9;">"${commentPreview.replace(/</g, '&lt;').replace(/>/g, '&gt;')}"</p>
    </div>
    <div style="margin:20px 0; padding:12px; background:#f8fafc; border-radius:12px;">
      <p style="margin:0; font-size:12px; font-weight:600; color:#1e293b;">Ticket: ${ticket.title}</p>
      <p style="margin:4px 0 0 0; font-size:11px; color:#64748b;">Status: ${ticket.status} | Priority: ${ticket.priority}</p>
    </div>
    <a href="${commentUrl}" style="display:block; text-align:center; background:#7c3aed; color:white; text-decoration:none; padding:12px; border-radius:12px; font-weight:700; font-size:13px;">
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
      } catch (emailErr) {
        console.error(`Failed to send comment email to ${stakeholder.email}:`, emailErr.message);
      }
      
    } catch (err) {
      console.error(`Failed to notify ${stakeholder.email}:`, err.message);
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

function isInternalTicket(creatorRole) {
  return ['Admin', 'Project Manager', 'Developer', 'Team Lead'].includes(creatorRole);
}

// ============================================
// CREATE TICKET
// ============================================

exports.createTicket = async (req, res) => {
  try {
    const { title, description, priority, projectId, feedId, isInternal, category, subcategory, subItem, ticketType, assignedTo, files } = req.body;
    
    const userRole = req.user.role;
    const shouldBeInternal = userRole !== 'Client' || isInternal === true;
    
    if (!shouldBeInternal && !projectId) {
      return res.status(400).json({ 
        error: 'Project is required for client tickets.' 
      });
    }
    
    if (userRole === 'Team Lead' && projectId) {
      const project = await Project.findOne({ 
        _id: projectId, 
        teamLead: req.user.id 
      });
      if (!project) {
        return res.status(403).json({ 
          error: 'You are not the Team Lead for this project. You can only create tickets for projects you manage.' 
        });
      }
    }
    
    const finalProjectId = projectId || null;
    const finalFeedId = feedId || null;
    
    let finalAssignedTo = null;
    
    if (assignedTo) {
      const developer = await User.findOne({ _id: assignedTo, role: 'Developer' });
      if (developer) {
        finalAssignedTo = developer._id;
        console.log(`   ✅ Assigned developer set: ${developer.name} (${developer._id})`);
      } else {
        console.log(`   ⚠️ Assigned developer not found or not a Developer role: ${assignedTo}`);
      }
    }
    
    if (!finalAssignedTo && feedId) {
      const feed = await Feed.findById(feedId).populate('assignedDevelopers', '_id');
      if (feed && feed.assignedDevelopers && feed.assignedDevelopers.length > 0) {
        finalAssignedTo = feed.assignedDevelopers[0]._id;
        console.log(`   Assigned from feed: ${finalAssignedTo}`);
      }
    }
    
    if (!finalAssignedTo && userRole === 'Developer') {
      finalAssignedTo = req.user.id;
      console.log(`   Auto-assigned ticket to creator (Developer): ${req.user.id}`);
    }
    
    const ticket = new Ticket({
      title,
      description,
      priority,
      projectId: finalProjectId,
      feedId: finalFeedId,
      createdBy: req.user.id,
      assignedTo: finalAssignedTo,
      isInternal: shouldBeInternal,
      category: category || '',
      subcategory: subcategory || '',
      subItem: subItem || '',
      ticketType: ticketType || '',
      files: files || [] 
    });
    
    await ticket.save();
    
    const creatorUser = await User.findById(req.user.id).select('name email role');
    
    let projectName = 'Unknown Project';
    let projectCustomId = 'N/A';
    let projectData = null;
    if (finalProjectId) {
      projectData = await Project.findById(finalProjectId).select('name projectCustomId teamLead projectManager');
      if (projectData) {
        projectName = projectData.name || 'Unknown Project';
        projectCustomId = projectData.projectCustomId || 'N/A';
      }
    }
    
    let feedName = null;
    if (finalFeedId) {
      const feed = await Feed.findById(finalFeedId).select('name');
      feedName = feed?.name || null;
    }
    
    const frontendUrl = process.env.FRONTEND_URL || 'http://192.168.1.105:5173';
    const stakeholders = await getTicketStakeholders(ticket, creatorUser);
    
    const assigneeInfo = await getAssigneeEmailFromRules(
      ticket.category || '',
      ticket.subcategory || '',
      ticket.subItem || ''
    );
    
    ticket.assigneeEmail = assigneeInfo.email;
    await ticket.save();
    
    const ruleAssigneeExists = stakeholders.some(s => s.email === assigneeInfo.email);
    if (!ruleAssigneeExists) {
      stakeholders.push({
        name: assigneeInfo.name,
        email: assigneeInfo.email,
        role: 'Support',
        type: 'support'
      });
    }
    
    console.log(`📧 Ticket ${ticket.ticketNumber} assigned to: ${assigneeInfo.email} (Rule: ${assigneeInfo.ruleId || 'Default'})`);
    
    const notificationMessage = `New ticket created: ${ticket.title} (${ticket.ticketNumber})`;
    
    for (const stakeholder of stakeholders) {
      if (stakeholder.email === creatorUser?.email) continue;
      
      const user = await User.findOne({ email: stakeholder.email });
      if (user) {
        await createNotification(user._id, {
          type: 'ticket_created',
          ticketId: ticket._id,
          message: notificationMessage
        });
      }
    }
    
    if (ticket.assignedTo) {
      await createNotification(ticket.assignedTo, {
        type: 'ticket_assigned',
        ticketId: ticket._id,
        message: `Ticket assigned to you: ${ticket.title} (${ticket.ticketNumber})`
      });
    }
    
    console.log(`📧 Sending ticket notifications for ${ticket.ticketNumber} to ${stakeholders.length} recipients...`);
    
    for (const stakeholder of stakeholders) {
      try {
        let emailHtml;
        let subject;
        
        if (stakeholder.type === 'poc') {
          emailHtml = getPOCNotificationTemplate(
            ticket,
            stakeholder.name,
            projectName,
            frontendUrl,
            feedName
          );
          subject = `📋 Support Ticket: ${ticket.ticketNumber} - ${ticket.title}`;
        } else if (ticket.isInternal) {
          emailHtml = getInternalTicketTemplate(
            ticket,
            creatorUser?.name || 'System',
            stakeholders,
            frontendUrl,
            feedName,
            projectName
          );
          subject = `🔒 Internal Ticket: ${ticket.ticketNumber} - ${ticket.title}`;
        } else {
          emailHtml = getTicketCreatedTemplate(
            ticket,
            creatorUser?.name || 'System',
            stakeholders,
            frontendUrl,
            feedName,
            projectName
          );
          subject = `📋 New Ticket: ${ticket.ticketNumber} - ${ticket.title}`;
        }
        
        await sendEmail({
          to: stakeholder.email,
          subject: subject,
          html: emailHtml
        });
        
        console.log(`   📧 Email sent to: ${stakeholder.email} (${stakeholder.type})`);
      } catch (err) {
        console.error(`   ❌ Failed to send email to ${stakeholder.email}:`, err.message);
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    const io = req.app.get('io');
    if (io) {
      const populatedTicket = await Ticket.findById(ticket._id)
        .populate('createdBy', 'name email role')
        .populate('assignedTo', 'name email')
        .populate('projectId', 'name projectCustomId')
        .populate('feedId', 'name');
      
      io.emit('ticket_created', populatedTicket);
      
      if (ticket.createdBy) {
        io.to(ticket.createdBy.toString()).emit('ticket_created', populatedTicket);
      }
      if (ticket.assignedTo) {
        io.to(ticket.assignedTo.toString()).emit('ticket_created', populatedTicket);
      }
      if (finalProjectId) {
        const project = await Project.findById(finalProjectId).populate('projectManager', '_id');
        if (project?.projectManager) {
          io.to(project.projectManager._id.toString()).emit('ticket_created', populatedTicket);
        }
      }
      if (finalProjectId) {
        const project = await Project.findById(finalProjectId).populate('teamLead', '_id');
        if (project?.teamLead) {
          io.to(project.teamLead._id.toString()).emit('ticket_created', populatedTicket);
        }
      }
      
      console.log(`📡 Socket notifications sent for ticket: ${ticket.ticketNumber}`);
    }
    
    return res.status(201).json({
      success: true,
      message: 'Ticket created successfully',
      ticket: ticket,
      emailsSent: stakeholders.length
    });
    
  } catch (error) {
    console.error('Error creating ticket:', error);
    return res.status(500).json({ 
      error: 'Failed to create ticket', 
      details: error.message 
    });
  }
};

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

// ============================================
// GET TICKETS - UPDATED WITH HR FIX
// ============================================

exports.getTickets = async (req, res) => {
  try {
    let filter = {};
    const userRole = req.user.role;
    const userId = req.user.id;

    console.log(`🔍 Fetching tickets for role: ${userRole}, userId: ${userId}`);

    if (userRole === 'Client') {
      filter = {
        $or: [
          { createdBy: userId },
          { assignedTo: userId }
        ]
      };
    } else if (userRole === 'Developer') {
      filter = {
        $or: [
          { assignedTo: userId },
          { createdBy: userId },
          { assignedTo: null }
        ]
      };
    } else if (userRole === 'Project Manager') {
      const pmProjects = await Project.find({ projectManager: userId }).select('_id');
      const projectIds = pmProjects.map(p => p._id);

      filter = {
        $or: [
          { projectId: { $in: projectIds } },
          { 
            $and: [
              { projectId: null },
              { category: 'Production' },
              { subcategory: 'Feasibility' }
            ]
          },
          { createdBy: userId },
          { assignedTo: userId }
        ]
      };
    } else if (userRole === 'Team Lead') {
      const tlProjects = await Project.find({ teamLead: userId }).select('_id');
      const projectIds = tlProjects.map(p => p._id);
      filter = {
        $or: [
          { projectId: { $in: projectIds } },
          { createdBy: userId },
          { assignedTo: userId }
        ]
      };
    } else if (userRole === 'HR') {
      console.log(`🔍 HR user fetching tickets`);
      
      // Get the current HR user's ID
      const hrUserId = req.user.id;
      
      // Get ALL HR user IDs
      const hrUsers = await User.find({ role: 'HR' }).distinct('_id');
      console.log(`👥 HR Users found: ${hrUsers.length}`, hrUsers);
      
      // Build comprehensive filter for HR
      filter = {
        $or: [
          // Category matches HR-related categories - THIS IS THE KEY FIX
          { category: { $in: ['HR', 'Admin', 'Payroll'] } },
          // Subcategory matches HR-related subcategories
          { subcategory: { $in: ['Employee Documents', 'Attendance & Leave', 'Employee Management'] } },
          // Created by the current HR user
          { createdBy: hrUserId },
          // Assigned to the current HR user
          { assignedTo: hrUserId },
          // Created by ANY HR user
          { createdBy: { $in: hrUsers } },
          // Assigned to ANY HR user
          { assignedTo: { $in: hrUsers } }
        ]
      };
      
      console.log(`🔍 HR filter:`, JSON.stringify(filter, null, 2));
      
    } else if (userRole === 'Finance') {
      console.log(`🔍 Finance user fetching tickets`);
      
      // Get the current Finance user's ID
      const financeUserId = req.user.id;
      
      const financeUsers = await User.find({ role: 'Finance' }).distinct('_id');
      console.log(`👥 Finance Users found: ${financeUsers.length}`, financeUsers);
      
      filter = {
        $or: [
          // Category matches Finance-related categories
          { category: { $in: ['Finance', 'Payroll', 'Admin'] } },
          // Subcategory matches Finance-related subcategories
          { subcategory: { $in: ['Reimbursement', 'Payment Requests', 'Invoice Management', 'Salary', 'Tax & Deductions'] } },
          // Created by the current Finance user
          { createdBy: financeUserId },
          // Assigned to the current Finance user
          { assignedTo: financeUserId },
          // Created by ANY Finance user
          { createdBy: { $in: financeUsers } },
          // Assigned to ANY Finance user
          { assignedTo: { $in: financeUsers } }
        ]
      };
      
      console.log(`🔍 Finance filter:`, JSON.stringify(filter, null, 2));
      
    } else if (userRole === 'Admin') {
      filter = {};
    }

    const tickets = await Ticket.find(filter)
      .populate('createdBy', 'name email role')
      .populate('assignedTo', 'name email')
      .populate('projectId', 'name projectCustomId')
      .populate('feedId', 'name')
      .sort({ createdAt: -1 });

    console.log(`🔍 Found ${tickets.length} tickets for ${userRole}`);
    
    if (tickets.length > 0) {
      console.log(`🔍 Ticket details:`, tickets.map(t => ({ 
        ticketNumber: t.ticketNumber,
        category: t.category, 
        subcategory: t.subcategory,
        title: t.title
      })));
    } else {
      console.log(`🔍 No tickets found for ${userRole}. Filter used:`, JSON.stringify(filter, null, 2));
      
      // DEBUG: Check total tickets and HR tickets
      const totalTickets = await Ticket.countDocuments();
      console.log(`📊 Total tickets in database: ${totalTickets}`);
      
      const hrTickets = await Ticket.find({ category: 'HR' });
      console.log(`📊 HR tickets found: ${hrTickets.length}`);
      if (hrTickets.length > 0) {
        console.log(`📊 HR tickets:`, hrTickets.map(t => ({ 
          ticketNumber: t.ticketNumber,
          title: t.title, 
          category: t.category, 
          subcategory: t.subcategory 
        })));
      }
    }

    res.json(tickets);
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
};

// ============================================
// GET SINGLE TICKET
// ============================================

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

// ============================================
// UPDATE TICKET STATUS
// ============================================

exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const canUpdate = 
      req.user.role === 'Admin' ||
      req.user.role === 'Project Manager' ||
      req.user.role === 'Team Lead' ||
      ticket.createdBy.toString() === req.user.id ||
      (req.user.role === 'Developer' && ticket.assignedTo?.toString() === req.user.id);

    if (!canUpdate) {
      return res.status(403).json({ error: 'Not authorized to update this ticket' });
    }

    const oldStatus = ticket.status;
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
    if (io) {
      io.emit('ticket_updated', updatedTicket);
      
      if (ticket.createdBy) {
        io.to(ticket.createdBy.toString()).emit('ticket_updated', updatedTicket);
      }
      if (ticket.assignedTo) {
        io.to(ticket.assignedTo.toString()).emit('ticket_updated', updatedTicket);
      }
      
      if (ticket.assignedTo) {
        await createNotification(ticket.assignedTo, {
          type: 'ticket_status_updated',
          ticketId: ticket._id,
          message: `Ticket ${ticket.ticketNumber} status changed from ${oldStatus} to ${status}`
        });
      }
      if (ticket.createdBy && ticket.createdBy.toString() !== ticket.assignedTo?.toString()) {
        await createNotification(ticket.createdBy, {
          type: 'ticket_status_updated',
          ticketId: ticket._id,
          message: `Ticket ${ticket.ticketNumber} status changed from ${oldStatus} to ${status}`
        });
      }
    }
    
    res.json(updatedTicket);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update status' });
  }
};

// ============================================
// ASSIGN TICKET
// ============================================

exports.assignTicket = async (req, res) => {
  try {
    const { assignedTo } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    const oldAssignee = ticket.assignedTo;
    ticket.assignedTo = assignedTo;
    await ticket.save();
    
    const updatedTicket = await Ticket.findById(ticket._id)
      .populate('createdBy', 'name email role')
      .populate('assignedTo', 'name email')
      .populate('projectId', 'name projectCustomId')
      .populate('feedId', 'name');
    
    const io = req.app.get('io');
    if (io) {
      io.emit('ticket_assigned', updatedTicket);
      
      if (assignedTo) {
        io.to(assignedTo.toString()).emit('ticket_assigned', updatedTicket);
        
        await createNotification(assignedTo, {
          type: 'ticket_assigned',
          ticketId: ticket._id,
          message: `Ticket ${ticket.ticketNumber} assigned to you: ${ticket.title}`
        });
      }
      
      if (ticket.createdBy) {
        io.to(ticket.createdBy.toString()).emit('ticket_assigned', updatedTicket);
      }
    }
    
    res.json(updatedTicket);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to assign ticket' });
  }
};

// ============================================
// ADD COMMENT
// ============================================

exports.addComment = async (req, res) => {
  try {
    const { text, images, files } = req.body;
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
    
    let hasImages = false;
    let hasFiles = false;
    
    if (images && images.length > 0) {
      commentData.images = images;
      hasImages = true;
    }
    
    if (files && files.length > 0) {
      commentData.files = files;
      hasFiles = true;
      
      const imageUrls = files.filter(f => f.type === 'image').map(f => f.url);
      if (imageUrls.length > 0) {
        hasImages = true;
        if (commentData.images) {
          commentData.images = [...commentData.images, ...imageUrls];
        } else {
          commentData.images = imageUrls;
        }
      }
    }
    
    ticket.comments.push(commentData);
    await ticket.save();
    
    const updatedTicket = await Ticket.findById(ticket._id)
      .populate('createdBy', 'name email role')
      .populate('assignedTo', 'name email')
      .populate('projectId', 'name projectCustomId')
      .populate('feedId', 'name')
      .populate('comments.userId', 'name');
    
    await notifyCommentStakeholders(
      updatedTicket,
      { name: req.user.name, email: req.user.email },
      text || '',
      hasImages,
      hasFiles
    );
    
    const io = req.app.get('io');
    
    io.to(`ticket_${req.params.id}`).emit('ticket_commented', updatedTicket);
    
    if (ticket.createdBy && ticket.createdBy.toString() !== req.user.id.toString()) {
      io.to(ticket.createdBy.toString()).emit('ticket_commented', updatedTicket);
    }
    
    if (ticket.assignedTo && ticket.assignedTo.toString() !== req.user.id.toString()) {
      io.to(ticket.assignedTo.toString()).emit('ticket_commented', updatedTicket);
    }
    
    res.json(updatedTicket);
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
};

// ============================================
// GET PROJECTS FOR DROPDOWN
// ============================================

exports.getProjects = async (req, res) => {
  try {
    let filter = {};
    
    if (req.user.role === 'Client') {
      const clientIdStr = req.user.id;
      
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
    
    const allProjects = await Project.find(filter)
      .select('name projectCustomId _id')
      .limit(50);
    
    res.json(allProjects);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
};

// ============================================
// GET FEEDS FOR DROPDOWN
// ============================================

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

// ============================================
// GET DEVELOPERS FOR ASSIGNMENT DROPDOWN
// ============================================

exports.getDevelopers = async (req, res) => {
  try {
    const developers = await User.find({ role: 'Developer' })
      .select('name email _id githubUsername githubLinked');
    
    res.json(developers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch developers' });
  }
};