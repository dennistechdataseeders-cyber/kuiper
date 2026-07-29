// backend/templates/productivityEmailTemplates.js

// ============================================
// DEVELOPER EMAIL TEMPLATE
// ============================================
const getDeveloperEmailTemplate = (data, frontendUrl) => {
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
          
          <!-- Header -->
          <tr>
            <td style="padding:32px 36px; border-bottom:1px solid #e2e8f0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right:12px; width:38px; vertical-align: middle;">
                    <img src="https://res.cloudinary.com/dhcwcyqke/image/upload/q_auto/f_auto/v1777631279/login_img_oycuic.png" alt="KUIPER" style="width:38px; height:38px; border-radius:10px; display:block;">
                  </td>
                  <td style="vertical-align: middle;">
                    <div style="font-size:20px; font-weight:800; color:#2563eb;">KUIPER</div>
                    <div style="font-size:8px; font-weight:600; color:#94a3b8; letter-spacing:0.25em; text-transform:uppercase; margin-top:3px;">Daily Productivity Report</div>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="background:#2563eb; color:white; padding:4px 12px; border-radius:12px; font-size:10px; font-weight:700;">Developer</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:32px 36px 20px 36px;">
              <h2 style="font-size:22px; font-weight:800; color:#0f172a; margin-bottom:8px;">Hello ${data.name}</h2>
              <p style="font-size:14px; color:#64748b; line-height:1.6;">Here is your daily productivity summary for <strong>${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong></p>
            </td>
          </tr>

          <!-- Stats Cards -->
          <tr>
            <td style="padding:0 36px 24px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                <tr>
                  <td width="50%" style="padding-right:8px;">
                    <div style="background:#dbeafe; padding:16px 20px; border-radius:14px; text-align:center;">
                      <div style="font-size:24px; font-weight:800; color:#1d4ed8;">${data.openTicketsCount}</div>
                      <div style="font-size:11px; font-weight:700; color:#64748b; margin-top:2px;">Open Tickets</div>
                    </div>
                  </td>
                  <td width="50%" style="padding-left:8px;">
                    <div style="background:#ede9fe; padding:16px 20px; border-radius:14px; text-align:center;">
                      <div style="font-size:24px; font-weight:800; color:#7c3aed;">${data.feasibilityTicketsCount}</div>
                      <div style="font-size:11px; font-weight:700; color:#64748b; margin-top:2px;">Feasibility Tickets</div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Open Tickets List -->
          ${data.openTickets.length > 0 ? `
          <tr>
            <td style="padding:0 36px 16px 36px;">
              <div style="font-size:12px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:12px;">Open Tickets (${data.openTicketsCount})</div>
              ${data.openTickets.map(ticket => `
              <div style="background:#f8fafc; border-left:4px solid #3b82f6; padding:12px 16px; border-radius:8px; margin-bottom:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <span style="font-weight:700; color:#0f172a; font-size:13px;">${ticket.ticketNumber}</span>
                    <span style="color:#475569; font-size:12px; margin-left:8px;">${ticket.title}</span>
                  </div>
                  <span style="background:${ticket.priority === 'Urgent' ? '#fee2e2' : ticket.priority === 'High' ? '#fef3c7' : '#dbeafe'}; padding:2px 10px; border-radius:10px; font-size:10px; font-weight:700; color:${ticket.priority === 'Urgent' ? '#dc2626' : ticket.priority === 'High' ? '#d97706' : '#2563eb'};">${ticket.priority}</span>
                </div>
              </div>
              `).join('')}
            </td>
          </tr>
          ` : `
          <tr>
            <td style="padding:0 36px 16px 36px;">
              <div style="background:#dcfce7; padding:12px 16px; border-radius:10px; border-left:4px solid #22c55e;">
                <span style="color:#15803d; font-size:13px; font-weight:600;">No open tickets. Great job!</span>
              </div>
            </td>
          </tr>
          `}

          <!-- Feasibility Tickets -->
          ${data.feasibilityTickets.length > 0 ? `
          <tr>
            <td style="padding:0 36px 16px 36px;">
              <div style="font-size:12px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:12px;">Feasibility Tickets (${data.feasibilityTicketsCount})</div>
              ${data.feasibilityTickets.map(ticket => `
              <div style="background:#f8fafc; border-left:4px solid #8b5cf6; padding:12px 16px; border-radius:8px; margin-bottom:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <span style="font-weight:700; color:#0f172a; font-size:13px;">${ticket.ticketNumber}</span>
                    <span style="color:#475569; font-size:12px; margin-left:8px;">${ticket.title}</span>
                  </div>
                  <span style="background:#ede9fe; padding:2px 10px; border-radius:10px; font-size:10px; font-weight:700; color:#7c3aed;">Feasibility</span>
                </div>
              </div>
              `).join('')}
            </td>
          </tr>
          ` : `
          <tr>
            <td style="padding:0 36px 16px 36px;">
              <div style="background:#f3e8ff; padding:12px 16px; border-radius:10px; border-left:4px solid #8b5cf6;">
                <span style="color:#6d28d9; font-size:13px; font-weight:600;">No pending feasibility tickets!</span>
              </div>
            </td>
          </tr>
          `}

          <!-- Action Button -->
          <tr>
            <td style="padding:20px 36px 32px 36px;">
              <a href="${frontendUrl}/tickets" style="display:block; text-align:center; background:#2563eb; color:white; text-decoration:none; padding:12px; border-radius:12px; font-weight:700; font-size:13px;">
                View All Tickets →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc; padding:24px 36px; text-align:center; border-radius:0 0 24px 24px;">
              <div style="font-size:10px; color:#94a3b8;">KUIPER CRM • Daily Productivity Report</div>
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

// ============================================
// SALES PERSON EMAIL TEMPLATE
// ============================================
const getSalesPersonEmailTemplate = (data, frontendUrl) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Sales Report</title>
  <style>
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; }
    .header { background: #f8fafc; padding: 32px 36px; border-bottom: 1px solid #e2e8f0; }
    .badge { background: #059669; color: #ffffff; padding: 4px 12px; border-radius: 12px; font-size: 10px; font-weight: 700; }
    .stats-grid { display: table; width: 100%; border-collapse: collapse; }
    .stats-cell { display: table-cell; width: 50%; padding: 8px; }
    .stat-box { background: #fef3c7; padding: 16px 20px; border-radius: 14px; text-align: center; }
    .stat-number { font-size: 24px; font-weight: 800; color: #d97706; }
    .stat-label { font-size: 11px; font-weight: 700; color: #64748b; margin-top: 2px; }
  </style>
</head>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background:#f0f4f8; color:#1e293b;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f4f8; padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%; background:#ffffff; border-radius:24px; box-shadow:0 4px 12px rgba(0,0,0,0.05);">
          
          <!-- Header -->
          <tr>
            <td style="padding:32px 36px; border-bottom:1px solid #e2e8f0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right:12px; width:38px; vertical-align: middle;">
                    <img src="https://res.cloudinary.com/dhcwcyqke/image/upload/q_auto/f_auto/v1777631279/login_img_oycuic.png" alt="KUIPER" style="width:38px; height:38px; border-radius:10px; display:block;">
                  </td>
                  <td style="vertical-align: middle; width:60%;">
                    <div style="font-size:20px; font-weight:800; color:#2563eb;">KUIPER</div>
                    <div style="font-size:8px; font-weight:600; color:#94a3b8; letter-spacing:0.25em; text-transform:uppercase; margin-top:2px;">Daily Productivity Report</div>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="background:#059669; color:white; padding:4px 14px; border-radius:12px; font-size:10px; font-weight:700; display:inline-block;">Sales</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:32px 36px 20px 36px;">
              <h2 style="font-size:22px; font-weight:800; color:#0f172a; margin:0 0 8px 0;">Hello ${data.name}</h2>
              <p style="font-size:14px; color:#64748b; line-height:1.6; margin:0;">
                Here is your daily sales summary for <strong>${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>
              </p>
            </td>
          </tr>

          <!-- Stats Cards -->
          <tr>
            <td style="padding:0 36px 24px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td width="50%" style="padding-right:8px; vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fef3c7; border-radius:14px;">
                      <tr>
                        <td style="padding:20px 16px; text-align:center;">
                          <div style="font-size:28px; font-weight:800; color:#d97706;">${data.totalFollowUps}</div>
                          <div style="font-size:11px; font-weight:700; color:#92400e; margin-top:2px;">Total Follow-ups</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="50%" style="padding-left:8px; vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ede9fe; border-radius:14px;">
                      <tr>
                        <td style="padding:20px 16px; text-align:center;">
                          <div style="font-size:28px; font-weight:800; color:#7c3aed;">${data.pendingFeasibility}</div>
                          <div style="font-size:11px; font-weight:700; color:#5b21b6; margin-top:2px;">Pending Feasibility</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Follow-up Details -->
          <tr>
            <td style="padding:0 36px 16px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffbeb; border-radius:12px; border:1px solid #fde68a;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td>
                          <div style="font-size:12px; font-weight:700; color:#92400e; letter-spacing:0.03em;">Follow-ups Pending</div>
                          <div style="font-size:32px; font-weight:800; color:#d97706; margin-top:4px;">${data.totalFollowUps}</div>
                        </td>
                        <td align="right" style="vertical-align:middle;">
                          <span style="background:#f59e0b; color:white; padding:6px 16px; border-radius:20px; font-size:10px; font-weight:700; display:inline-block;">ACTION REQUIRED</span>
                        </td>
                      </tr>
                    </table>
                    <p style="font-size:11px; color:#78350f; margin:8px 0 0 0;">Follow-up on these leads to keep your pipeline moving.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Feasibility Details -->
          <tr>
            <td style="padding:0 36px 24px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f3ff; border-radius:12px; border:1px solid #ddd6fe;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td>
                          <div style="font-size:12px; font-weight:700; color:#5b21b6; letter-spacing:0.03em;">Feasibility Requests</div>
                          <div style="font-size:32px; font-weight:800; color:#7c3aed; margin-top:4px;">${data.pendingFeasibility}</div>
                        </td>
                        <td align="right" style="vertical-align:middle;">
                          <span style="background:#7c3aed; color:white; padding:4px 14px; border-radius:12px; font-size:9px; font-weight:700; display:inline-block;">PENDING</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Tips / Encouragement -->
          <tr>
            <td style="padding:0 36px 20px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0fdf4; border-radius:12px; border:1px solid #bbf7d0;">
                <tr>
                  <td style="padding:14px 18px;">
                    <p style="font-size:12px; color:#166534; margin:0; font-weight:600;">
                      Tip: ${data.totalFollowUps > 0 ? 'You have ' + data.totalFollowUps + ' follow-ups pending. Prioritize the most urgent ones first.' : 'Great job. All follow-ups are complete. Focus on generating new leads today.'}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Action Button -->
          <tr>
            <td style="padding:0 36px 32px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#059669; border-radius:12px;">
                <tr>
                  <td align="center" style="padding:14px 20px;">
                    <a href="${frontendUrl}/sales" style="color:#ffffff; text-decoration:none; font-weight:700; font-size:13px; display:block; text-align:center;">
                      View Sales Dashboard →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc; padding:24px 36px; text-align:center; border-radius:0 0 24px 24px;">
              <div style="font-size:10px; color:#94a3b8;">KUIPER CRM • Daily Productivity Report</div>
              <div style="font-size:8px; color:#e2e8f0; margin-top:6px;">This is an automated report. Please do not reply to this email.</div>
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

// ============================================
// PROJECT MANAGER EMAIL TEMPLATE
// ============================================
const getPMEmailTemplate = (data, frontendUrl) => {
  const hasTickets = Object.keys(data.ticketsByDeveloper).length > 0;
  
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
        <table width="650" cellpadding="0" cellspacing="0" border="0" style="max-width:650px; width:100%; background:#ffffff; border-radius:24px; box-shadow:0 4px 12px rgba(0,0,0,0.05); overflow:hidden;">
          
          <!-- Header -->
          <tr>
            <td style="padding:32px 36px; border-bottom:1px solid #e2e8f0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right:12px; width:38px; vertical-align: middle;">
                    <img src="https://res.cloudinary.com/dhcwcyqke/image/upload/q_auto/f_auto/v1777631279/login_img_oycuic.png" alt="KUIPER" style="width:38px; height:38px; border-radius:10px; display:block;">
                  </td>
                  <td style="vertical-align: middle;">
                    <div style="font-size:20px; font-weight:800; color:#2563eb;">KUIPER</div>
                    <div style="font-size:8px; font-weight:600; color:#94a3b8; letter-spacing:0.25em; text-transform:uppercase; margin-top:3px;">Daily Productivity Report</div>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="background:#0d9488; color:white; padding:4px 12px; border-radius:12px; font-size:10px; font-weight:700;">PM</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:32px 36px 20px 36px;">
              <h2 style="font-size:22px; font-weight:800; color:#0f172a; margin-bottom:8px;">Hello ${data.name}</h2>
              <p style="font-size:14px; color:#64748b; line-height:1.6;">Here is your project summary for <strong>${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong></p>
            </td>
          </tr>

          <!-- Stats -->
          <tr>
            <td style="padding:0 36px 24px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                <tr>
                  <td width="33%" style="padding-right:6px;">
                    <div style="background:#dbeafe; padding:12px 16px; border-radius:12px; text-align:center;">
                      <div style="font-size:20px; font-weight:800; color:#1d4ed8;">${data.totalProjects}</div>
                      <div style="font-size:9px; font-weight:700; color:#64748b;">Projects</div>
                    </div>
                  </td>
                  <td width="33%" style="padding:0 6px;">
                    <div style="background:#fee2e2; padding:12px 16px; border-radius:12px; text-align:center;">
                      <div style="font-size:20px; font-weight:800; color:#dc2626;">${data.unresolvedTicketsCount}</div>
                      <div style="font-size:9px; font-weight:700; color:#64748b;">Unresolved</div>
                    </div>
                  </td>
                  <td width="33%" style="padding-left:6px;">
                    <div style="background:#fef3c7; padding:12px 16px; border-radius:12px; text-align:center;">
                      <div style="font-size:20px; font-weight:800; color:#d97706;">${Object.keys(data.ticketsByDeveloper).length}</div>
                      <div style="font-size:9px; font-weight:700; color:#64748b;">Developers</div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Tickets by Developer -->
          <tr>
            <td style="padding:0 36px 24px 36px;">
              <div style="font-size:13px; font-weight:700; color:#0f172a; margin-bottom:12px;">Unresolved Tickets by Developer</div>
              
              ${hasTickets ? Object.entries(data.ticketsByDeveloper).map(([developer, tickets]) => `
              <div style="background:#f8fafc; border-radius:12px; padding:16px; margin-bottom:12px; border:1px solid #e2e8f0;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                  <span style="font-weight:700; color:#0f172a; font-size:14px;">${developer}</span>
                  <span style="background:#e2e8f0; padding:2px 10px; border-radius:10px; font-size:10px; font-weight:700; color:#475569;">${tickets.length} tickets</span>
                </div>
                ${tickets.map(ticket => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid #f1f5f9;">
                  <div>
                    <span style="font-weight:600; color:#0f172a; font-size:12px;">${ticket.ticketNumber}</span>
                    <span style="color:#475569; font-size:11px; margin-left:6px;">${ticket.title}</span>
                  </div>
                  <span style="background:${ticket.priority === 'Urgent' ? '#fee2e2' : ticket.priority === 'High' ? '#fef3c7' : '#dbeafe'}; padding:1px 8px; border-radius:8px; font-size:8px; font-weight:700; color:${ticket.priority === 'Urgent' ? '#dc2626' : ticket.priority === 'High' ? '#d97706' : '#2563eb'};">${ticket.priority}</span>
                </div>
                `).join('')}
              </div>
              `).join('') : `
              <div style="background:#dcfce7; padding:16px; border-radius:12px; border-left:4px solid #22c55e;">
                <span style="color:#15803d; font-size:13px; font-weight:600;">All tickets resolved. Great job team!</span>
              </div>
              `}
            </td>
          </tr>

          <!-- Action Button -->
          <tr>
            <td style="padding:0 36px 32px 36px;">
              <a href="${frontendUrl}/tickets" style="display:block; text-align:center; background:#0d9488; color:white; text-decoration:none; padding:12px; border-radius:12px; font-weight:700; font-size:13px;">
                View All Tickets →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc; padding:24px 36px; text-align:center; border-radius:0 0 24px 24px;">
              <div style="font-size:10px; color:#94a3b8;">KUIPER CRM • Daily Productivity Report</div>
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

// ============================================
// SALES MANAGER EMAIL TEMPLATE
// ============================================
const getSalesManagerEmailTemplate = (data, frontendUrl) => {
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
          
          <!-- Header -->
          <tr>
            <td style="padding:32px 36px; border-bottom:1px solid #e2e8f0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right:12px; width:38px; vertical-align: middle;">
                    <img src="https://res.cloudinary.com/dhcwcyqke/image/upload/q_auto/f_auto/v1777631279/login_img_oycuic.png" alt="KUIPER" style="width:38px; height:38px; border-radius:10px; display:block;">
                  </td>
                  <td style="vertical-align: middle;">
                    <div style="font-size:20px; font-weight:800; color:#2563eb;">KUIPER</div>
                    <div style="font-size:8px; font-weight:600; color:#94a3b8; letter-spacing:0.25em; text-transform:uppercase; margin-top:3px;">Daily Productivity Report</div>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="background:#7c3aed; color:white; padding:4px 12px; border-radius:12px; font-size:10px; font-weight:700;">Sales Manager</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:32px 36px 20px 36px;">
              <h2 style="font-size:22px; font-weight:800; color:#0f172a; margin-bottom:8px;">Hello ${data.name}</h2>
              <p style="font-size:14px; color:#64748b; line-height:1.6;">Here is your team's sales summary for <strong>${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong></p>
            </td>
          </tr>

          <!-- Total Stats -->
          <tr>
            <td style="padding:0 36px 24px 36px;">
              <div style="background:linear-gradient(135deg, #7c3aed, #6d28d9); padding:20px; border-radius:16px; text-align:center;">
                <div style="font-size:36px; font-weight:800; color:white;">${data.totalFollowUpsToday}</div>
                <div style="font-size:12px; font-weight:700; color:#c4b5fd;">Total Follow-ups Taken Today</div>
                <div style="font-size:10px; color:#a78bfa; margin-top:4px;">Across ${data.employeeBreakdown.length} team members</div>
              </div>
            </td>
          </tr>

          <!-- Employee Breakdown -->
          <tr>
            <td style="padding:0 36px 24px 36px;">
              <div style="font-size:13px; font-weight:700; color:#0f172a; margin-bottom:12px;">Employee Breakdown</div>
              
              ${data.employeeBreakdown.map(emp => `
              <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 16px; background:#f8fafc; border-radius:10px; margin-bottom:6px; border:1px solid #e2e8f0;">
                <div>
                  <span style="font-weight:600; color:#0f172a; font-size:13px;">${emp.name}</span>
                  <span style="color:#94a3b8; font-size:10px; margin-left:8px;">${emp.email}</span>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-weight:800; color:#7c3aed; font-size:16px;">${emp.followUpsToday}</span>
                  <span style="font-size:10px; color:#94a3b8;">follow-ups</span>
                  ${emp.followUpsToday === 0 ? '<span style="background:#fef2f2; color:#dc2626; padding:2px 8px; border-radius:8px; font-size:8px; font-weight:700;">NO ACTIVITY</span>' : ''}
                </div>
              </div>
              `).join('')}
            </td>
          </tr>

          <!-- Insights -->
          <tr>
            <td style="padding:0 36px 20px 36px;">
              <div style="background:#f5f3ff; border-radius:12px; padding:16px; border:1px solid #ddd6fe;">
                <div style="font-size:11px; font-weight:700; color:#5b21b6; text-transform:uppercase; letter-spacing:0.06em;">Insights</div>
                <ul style="margin-top:8px; font-size:12px; color:#4c1d95; list-style:none; padding:0;">
                  <li style="padding:4px 0;">• ${data.employeeBreakdown.filter(e => e.followUpsToday > 0).length}/${data.employeeBreakdown.length} team members active today</li>
                  ${data.employeeBreakdown.filter(e => e.followUpsToday === 0).length > 0 ? `<li style="padding:4px 0;">${data.employeeBreakdown.filter(e => e.followUpsToday === 0).map(e => e.name).join(', ')} - No follow-ups recorded today</li>` : ''}
                </ul>
              </div>
            </td>
          </tr>

          <!-- Action Button -->
          <tr>
            <td style="padding:0 36px 32px 36px;">
              <a href="${frontendUrl}/sales-manager" style="display:block; text-align:center; background:#7c3aed; color:white; text-decoration:none; padding:12px; border-radius:12px; font-weight:700; font-size:13px;">
                View Sales Manager Dashboard →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc; padding:24px 36px; text-align:center; border-radius:0 0 24px 24px;">
              <div style="font-size:10px; color:#94a3b8;">KUIPER CRM • Daily Productivity Report</div>
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

// ============================================
// EXPORT ALL TEMPLATES
// ============================================
module.exports = {
  getDeveloperEmailTemplate,
  getSalesPersonEmailTemplate,
  getPMEmailTemplate,
  getSalesManagerEmailTemplate
};