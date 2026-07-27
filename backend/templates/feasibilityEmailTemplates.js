// backend/templates/feasibilityEmailTemplates.js

const getFeasibilityCreatedTemplate = (feasibility, salesPerson, salesManager, pm, frontendUrl) => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

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
        <table width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px; width:100%; background:#ffffff; border-radius:24px; box-shadow:0 4px 12px rgba(0,0,0,0.05); overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="padding:32px 36px; border-bottom:1px solid #e2e8f0;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding-right:12px; width:38px; vertical-align: middle;">
                    <img src="https://res.cloudinary.com/dhcwcyqke/image/upload/q_auto/f_auto/v1777631279/login_img_oycuic.png" alt="KUIPER" style="width:38px; height:38px; border-radius:10px; display:block;">
                  </td>
                  <td style="vertical-align: middle;">
                    <div style="font-size:20px; font-weight:800; color:#2563eb;">KUIPER</div>
                    <div style="font-size:8px; font-weight:600; color:#94a3b8; letter-spacing:0.25em; text-transform:uppercase; margin-top:3px;">Feasibility Management</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Status Banner -->
          <tr>
            <td style="background:#7c3aed; padding:28px 36px;">
              <div style="font-size:24px; font-weight:800; color:white; margin-bottom:4px;">🔬 Feasibility Request Created</div>
              <div style="font-size:13px; color:#c4b5fd; font-weight:500;">${feasibility.feasibilityId}</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">
              <p style="font-size:15px; margin:0 0 20px 0; line-height:1.6; color:#1e293b;">
                A new feasibility request has been created by <strong>${salesPerson.name}</strong>.
              </p>

              <!-- Feasibility Details -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; border-collapse: separate; margin-bottom:24px;">
                <tr>
                  <td width="50%" style="padding:14px 18px; border-bottom:1px solid #e2e8f0; border-right:1px solid #e2e8f0;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Feasibility ID</div>
                    <div style="font-size:15px; font-weight:800; color:#7c3aed; margin-top:2px;">${feasibility.feasibilityId}</div>
                  </td>
                  <td width="50%" style="padding:14px 18px; border-bottom:1px solid #e2e8f0;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Date</div>
                    <div style="font-size:14px; font-weight:700; color:#1e293b; margin-top:2px;">${new Date(feasibility.feasibilityDate).toLocaleDateString()}</div>
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding:14px 18px; border-right:1px solid #e2e8f0;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Sales Rep</div>
                    <div style="font-size:14px; font-weight:700; color:#1e293b; margin-top:2px;">${salesPerson.name}</div>
                  </td>
                  <td width="50%" style="padding:14px 18px;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Project Manager</div>
                    <div style="font-size:14px; font-weight:700; color:#7c3aed; margin-top:2px;">${pm?.name || 'Unassigned'}</div>
                  </td>
                </tr>
                ${feasibility.followUpDate ? `
                <tr>
                  <td colspan="2" style="padding:14px 18px;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Next Follow-up</div>
                    <div style="font-size:14px; font-weight:700; color:#1e293b; margin-top:2px;">${new Date(feasibility.followUpDate).toLocaleDateString()}</div>
                  </td>
                </tr>
                ` : ''}
              </table>

              <!-- Task Details -->
              ${feasibility.taskDetails ? `
              <div style="background:#f8fafc; padding:16px 20px; border-radius:12px; margin-bottom:20px;">
                <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:6px;">Task Details</div>
                <p style="margin:0; font-size:13px; line-height:1.6; color:#334155;">${feasibility.taskDetails}</p>
              </div>
              ` : ''}

              <!-- Action Button -->
              <a href="${frontendUrl}/feasibility" style="display:block; text-align:center; background:#7c3aed; color:white; text-decoration:none; padding:14px; border-radius:12px; font-weight:700; font-size:14px;">
                View Feasibility Dashboard →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc; padding:24px 36px; text-align:center; border-radius:0 0 24px 24px;">
              <div style="font-size:10px; color:#94a3b8;">KUIPER CRM • Automated Feasibility Notification</div>
              <div style="font-size:9px; color:#cbd5e1; margin-top:2px;">${currentDate}</div>
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
  getFeasibilityCreatedTemplate
};