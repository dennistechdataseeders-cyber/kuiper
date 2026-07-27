// backend/templates/leadEmailTemplates.js

const getLeadCreatedTemplate = (lead, salesRep, recipient, frontendUrl) => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const isManager = recipient.role === 'Sales Manager';
  const title = isManager ? 'New Lead Created' : 'Lead Created Successfully';
  const subtitle = isManager ? `A new lead has been created by ${salesRep.name}` : `Your lead has been created successfully`;

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
                    <div style="font-size:8px; font-weight:600; color:#94a3b8; letter-spacing:0.25em; text-transform:uppercase; margin-top:3px;">Lead Management</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#2563eb; padding:24px 36px;">
              <div style="font-size:20px; font-weight:800; color:white;">🎯 ${title}</div>
              <div style="font-size:13px; color:#93c5fd; margin-top:4px;">${lead.leadNumber}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 36px;">
              <p style="font-size:14px; margin:0 0 16px 0; color:#1e293b;">
                ${subtitle}.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; border-collapse: separate; margin-bottom:20px;">
                <tr>
                  <td width="50%" style="padding:12px 16px; border-bottom:1px solid #e2e8f0; border-right:1px solid #e2e8f0;">
                    <div style="font-size:9px; font-weight:700; color:#64748b; text-transform:uppercase;">Lead Number</div>
                    <div style="font-size:14px; font-weight:700; color:#1e293b; margin-top:2px;">${lead.leadNumber}</div>
                  </td>
                  <td width="50%" style="padding:12px 16px; border-bottom:1px solid #e2e8f0;">
                    <div style="font-size:9px; font-weight:700; color:#64748b; text-transform:uppercase;">Source</div>
                    <div style="font-size:14px; font-weight:700; color:#1e293b; margin-top:2px;">${lead.leadType}</div>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:12px 16px;">
                    <div style="font-size:9px; font-weight:700; color:#64748b; text-transform:uppercase;">Sales Rep</div>
                    <div style="font-size:14px; font-weight:700; color:#1e293b; margin-top:2px;">${salesRep.name}</div>
                  </td>
                </tr>
              </table>
              <a href="${frontendUrl}/sales/lead_generation" style="display:block; text-align:center; background:#2563eb; color:white; text-decoration:none; padding:12px; border-radius:12px; font-weight:700; font-size:13px;">
                View Lead →
              </a>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc; padding:20px 36px; text-align:center; border-radius:0 0 24px 24px;">
              <div style="font-size:10px; color:#94a3b8;">KUIPER CRM • Automated Lead Notification</div>
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

module.exports = { getLeadCreatedTemplate };