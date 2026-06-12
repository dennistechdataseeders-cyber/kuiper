// backend/templates/ticketEmailTemplates.js

const getTicketCreatedTemplate = (ticket, creatorName, recipientsList, frontendUrl, feedName) => {
  const ticketUrl = `${frontendUrl}/tickets/${ticket._id}`;
  const currentDate = new Date().toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Filter out POC from team display for internal emails
  const internalTeam = recipientsList.filter(r => r.type !== 'poc');
  const hasFeed = feedName && feedName !== 'null' && feedName !== 'undefined';

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
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%; background:#ffffff; border-radius:24px; box-shadow:0 4px 12px rgba(0,0,0,0.05); overflow:hidden;">

          <tr>
            <td style="padding:36px 40px; border-bottom:1px solid #e2e8f0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right:14px; width:42px; vertical-align: middle;">
                    <img src="https://res.cloudinary.com/dhcwcyqke/image/upload/q_auto/f_auto/v1777631279/login_img_oycuic.png" alt="KUIPER" style="width:42px; height:42px; border-radius:12px; display:block;">
                  </td>
                  <td style="vertical-align: middle;">
                    <div style="font-size:22px; font-weight:800; color:#2563eb;">KUIPER</div>
                    <div style="font-size:9px; font-weight:600; color:#94a3b8; letter-spacing:0.25em; text-transform:uppercase; margin-top:4px;">Engineered for Operations</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:40px 40px 20px 40px;">
              <div style="color:#64748b; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; margin-bottom:8px;">Ticket Title</div>
              <div style="font-size:22px; font-weight:800; color:#0f172a; line-height:1.35; margin-bottom:8px;">${ticket.title}</div>
            </td>
          </tr>

          <tr>
            <td style="padding:0 40px 32px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; border-collapse: separate;">
                <tr>
                  <td width="50%" style="padding:16px 20px; border-bottom:1px solid #e2e8f0; border-right:1px solid #e2e8f0; vertical-align: top;">
                    <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px;">Ticket Number</div>
                    <div style="font-size:16px; font-weight:800; color:#0f172a;">${ticket.ticketNumber}</div>
                  </td>
                  <td width="50%" style="padding:16px 20px; border-bottom:1px solid #e2e8f0; vertical-align: top;">
                    <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px;">Project Name</div>
                    <div style="font-size:14px; font-weight:600; color:#334155;">${ticket.projectId?.name || 'Unknown Project'}</div>
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding:16px 20px; border-right:1px solid #e2e8f0; border-bottom:${hasFeed ? '1px solid #e2e8f0' : 'none'}; vertical-align: top;">
                    <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px;">Priority</div>
                    <span style="background:${ticket.priority === 'Urgent' ? '#fee2e2' : ticket.priority === 'High' ? '#fff3e0' : ticket.priority === 'Medium' ? '#fef9c3' : '#dcfce7'}; padding:4px 10px; border-radius:12px; font-size:11px; font-weight:700; color:${ticket.priority === 'Urgent' ? '#dc2626' : ticket.priority === 'High' ? '#ea580c' : ticket.priority === 'Medium' ? '#ca8a04' : '#16a34a'}; display:inline-block;">${ticket.priority}</span>
                  </td>
                  <td width="50%" style="padding:16px 20px; border-bottom:${hasFeed ? '1px solid #e2e8f0' : 'none'}; vertical-align: top;">
                    <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px;">Status</div>
                    <span style="background:#e0e7ff; padding:4px 10px; border-radius:12px; font-size:11px; font-weight:700; color:#4338ca; display:inline-block;">${ticket.status}</span>
                  </td>
                </tr>
                ${hasFeed ? `
                <tr>
                  <td width="50%" style="padding:16px 20px; border-right:1px solid #e2e8f0; vertical-align: top;">
                    <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px;">Feed Component</div>
                    <div style="font-size:14px; font-weight:700; color:#1e40af;">${feedName}</div>
                  </td>
                  <td width="50%" style="padding:16px 20px; vertical-align: top;">
                    <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px;">Date Created</div>
                    <div style="font-size:13px; font-weight:600; color:#475569;">${currentDate}</div>
                  </td>
                </tr>
                ` : `
                <tr>
                  <td colspan="2" style="padding:16px 20px; vertical-align: top;">
                    <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px;">Date Created</div>
                    <div style="font-size:13px; font-weight:600; color:#475569;">${currentDate}</div>
                  </td>
                </tr>
                `}
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 40px 36px 40px;">
              <div style="font-size:12px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:12px;">Ticket Description</div>
              <div style="background:#f8fafc; padding:24px 26px; border-radius:16px; border-left:4px solid #3b82f6;">
                <p style="margin:0; font-size:14px; line-height:1.7; color:#334155; white-space: pre-line;">${ticket.description}</p>
              </div>
            </td>
          </tr>

          ${internalTeam.length > 0 ? `
          <tr>
            <td style="padding:0 40px 36px 40px;">
              <div style="font-size:12px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:12px;">Assigned Team</div>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; border-collapse: separate;">
                ${internalTeam.map((r, idx) => `
                  <tr>
                    <td style="padding:14px 20px; ${idx < internalTeam.length - 1 ? 'border-bottom:1px solid #e2e8f0;' : ''} font-size:14px; font-weight:700; color:#0f172a;">
                      ${r.name}
                    </td>
                  </tr>
                `).join('')}
              </table>
            </td>
          </tr>
          ` : ''}

          <tr>
            <td style="padding:0 40px 32px 40px; text-align:center;">
              <img src="https://res.cloudinary.com/dhcwcyqke/image/upload/q_auto/f_auto/v1779973871/image_1_1_c60r0l.png" alt="KUIPER Footer" style="width:160px; max-width:60%; display:inline-block;">
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc; padding:28px 40px; text-align:center; border-radius:0 0 24px 24px;">
              <div style="font-size:11px; color:#94a3b8; line-height:1.7;">
                This is an automated notification from KUIPER CRM.<br>
                Please do not reply to this email.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
  `;
};

const getInternalTicketTemplate = (ticket, creatorName, recipientsList, frontendUrl, feedName) => {
  const ticketUrl = `${frontendUrl}/tickets/${ticket._id}`;
  const currentDate = new Date().toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const hasFeed = feedName && feedName !== 'null' && feedName !== 'undefined';

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
              <div style="font-size:13px; font-weight:700; color:#475569; letter-spacing:0.06em; text-transform:uppercase;">Internal Task Matrix</div>
              <div style="font-size:26px; font-weight:800; color:#0f172a; margin-top:6px;">${ticket.ticketNumber}</div>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 36px 20px 36px;">
              <div style="font-size:18px; font-weight:800; color:#0f172a; margin-bottom:20px; line-height:1.4;">${ticket.title}</div>
              
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; border-collapse: separate; margin-bottom:24px;">
                <tr>
                  <td width="50%" style="padding:12px 16px; border-bottom:1px solid #e2e8f0; border-right:1px solid #e2e8f0;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase;">Project</div>
                    <div style="font-size:13px; font-weight:600; color:#1e293b; margin-top:2px;">${ticket.projectId?.name || 'Unknown Project'}</div>
                  </td>
                  <td width="50%" style="padding:12px 16px; border-bottom:1px solid #e2e8f0;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase;">Feed Component</div>
                    <div style="font-size:13px; font-weight:700; color:#1e40af; margin-top:2px;">${hasFeed ? feedName : 'None Specified'}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 16px; border-right:1px solid #e2e8f0;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase;">Priority / Status</div>
                    <div style="font-size:13px; font-weight:600; color:#1e293b; margin-top:2px;">${ticket.priority} / ${ticket.status}</div>
                  </td>
                  <td style="padding:12px 16px;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase;">Created On</div>
                    <div style="font-size:13px; font-weight:600; color:#1e293b; margin-top:2px;">${currentDate}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 36px 28px 36px;">
              <div style="background:#f8fafc; padding:20px 22px; border-radius:12px;">
                <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:12px;">Operational Log Description</div>
                <p style="margin:0; font-size:14px; line-height:1.6; color:#334155; white-space: pre-line;">${ticket.description}</p>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:0 36px 32px 36px;">
              <a href="${ticketUrl}" style="display:inline-block; background:#2563eb; color:white; text-decoration:none; padding:12px 28px; border-radius:40px; font-weight:700; font-size:13px;">View Task →</a>
            </td>
          </tr>

          <tr>
            <td style="padding:0 36px 28px 36px; text-align:center;">
              <img src="https://res.cloudinary.com/dhcwcyqke/image/upload/q_auto/f_auto/v1779973871/image_1_1_c60r0l.png" alt="KUIPER Footer" style="width:140px; max-width:60%; display:inline-block;">
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc; padding:24px 36px; text-align:center; border-radius:0 0 24px 24px;">
              <div style="font-size:10px; color:#94a3b8;">KUIPER CRM • Automated Operational Notification</div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
  `;
};

const getPOCNotificationTemplate = (ticket, pocName, projectName, frontendUrl, feedName) => {
  const ticketUrl = `${frontendUrl}/tickets/${ticket._id}`;
  const hasFeed = feedName && feedName !== 'null' && feedName !== 'undefined';

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
        <table width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px; width:100%; background:#ffffff; border-radius:24px; box-shadow:0 4px 12px rgba(0,0,0,0.05); overflow:hidden;">

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
            <td style="background:linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding:36px;">
              <div style="font-size:22px; font-weight:800; color:white; margin-bottom:6px;">Support Request Acknowledged</div>
              <div style="font-size:13px; color:#cbd5e1; font-weight:500;">Project Scope: ${projectName}</div>
            </td>
          </tr>

          <tr>
            <td style="padding:36px 36px 20px 36px;">
              <p style="font-size:15px; margin:0 0 16px 0; line-height:1.6; color:#1e293b;">Dear <strong>${pocName}</strong>,</p>
              <p style="font-size:14px; color:#475569; margin-bottom:24px; line-height:1.7;">Your support ticket has been registered. Our system matrix has generated the form log entry detailed below. A technical team member will follow up shortly.</p>
              
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9; border-left:4px solid #2563eb; border-radius:4px 16px 16px 4px; border-collapse: separate; margin-bottom:28px;">
                <tr>
                  <td width="50%" style="padding:16px 20px; border-bottom:1px solid #e2e8f0; border-right:1px solid #e2e8f0;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Reference ID</div>
                    <div style="font-size:16px; font-weight:800; color:#1e293b; margin-top:2px;">${ticket.ticketNumber}</div>
                  </td>
                  <td width="50%" style="padding:16px 20px; border-bottom:1px solid #e2e8f0;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Assigned
                     Feed</div>
                    <div style="font-size:13px; font-weight:700; color:#1e40af; margin-top:2px;">${hasFeed ? feedName : 'General Stream'}</div>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:16px 20px;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px;">Subject Summary</div>
                    <div style="font-size:14px; font-weight:600; color:#1e293b; line-height:1.4;">"${ticket.title}"</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 36px 28px 36px;">
              <div style="font-size:12px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:12px;">Workflow Steps</div>
              <ul style="margin:0; padding-left:20px; color:#475569; font-size:13px; line-height:1.8;">
                <li style="margin-bottom:6px;">Our operations team evaluates structural parameters.</li>
                <li style="margin-bottom:6px;">An engineering specialist gets delegated to your query.</li>
                <li>Real-time automated lifecycle milestones dispatch directly to your inbox.</li>
              </ul>
            </td>
          </tr>

          <tr>
            <td style="padding:0 36px 36px 36px;">
              <a href="${ticketUrl}" style="display:inline-block; background:#2563eb; color:white; text-decoration:none; padding:14px 32px; border-radius:40px; font-weight:700; font-size:14px;">Track Your Ticket →</a>
            </td>
          </tr>

          <tr>
            <td style="padding:0 36px 28px 36px; text-align:center;">
              <img src="https://res.cloudinary.com/dhcwcyqke/image/upload/q_auto/f_auto/v1779973871/image_1_1_c60r0l.png" alt="KUIPER Footer" style="width:140px; max-width:60%; display:inline-block;">
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc; padding:28px 36px; text-align:center; border-radius:0 0 24px 24px;">
              <div style="font-size:11px; color:#94a3b8; line-height:1.6;">
                KUIPER Operational Support<br>
                Targeted response window: &lt; 24 business hours
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
  `;
};

module.exports = {
  getTicketCreatedTemplate,
  getInternalTicketTemplate,
  getPOCNotificationTemplate
};