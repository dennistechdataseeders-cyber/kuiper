// backend/templates/holidayEmailTemplates.js

const getHolidayCreatedTemplate = (data) => {
  const { name, date, description, isOptional, frontendUrl } = data;
  
  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
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
        <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; width:100%; background:#ffffff; border-radius:24px; box-shadow:0 4px 12px rgba(0,0,0,0.05); overflow:hidden;">
          <tr>
            <td style="padding:32px 36px; border-bottom:1px solid #e2e8f0;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding-right:12px; width:38px; vertical-align: middle;">
                    <img src="https://res.cloudinary.com/dhcwcyqke/image/upload/q_auto/f_auto/v1777631279/login_img_oycuic.png" alt="KUIPER" style="width:38px; height:38px; border-radius:10px; display:block;">
                  </td>
                  <td style="vertical-align: middle;">
                    <div style="font-size:20px; font-weight:800; color:#2563eb;">KUIPER</div>
                    <div style="font-size:8px; font-weight:600; color:#94a3b8; letter-spacing:0.25em; text-transform:uppercase; margin-top:3px;">Holiday Notification</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#fbbf24; padding:28px 36px;">
              <div style="font-size:22px; font-weight:800; color:#78350f; margin-bottom:4px;">🎉 New Holiday Added</div>
              <div style="font-size:13px; color:#92400e; font-weight:500;">Stay informed about upcoming days off</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 36px;">
              <p style="font-size:15px; margin:0 0 8px 0; line-height:1.6; color:#1e293b;">Dear Team,</p>
              <p style="font-size:14px; color:#475569; margin-bottom:24px; line-height:1.7;">
                A new holiday has been added to the company calendar:
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; border-collapse: separate; margin-bottom:24px;">
                <tr>
                  <td width="50%" style="padding:16px 20px; border-bottom:1px solid #e2e8f0; border-right:1px solid #e2e8f0;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Holiday</div>
                    <div style="font-size:16px; font-weight:800; color:#0f172a; margin-top:4px;">${name}</div>
                  </td>
                  <td width="50%" style="padding:16px 20px; border-bottom:1px solid #e2e8f0;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Date</div>
                    <div style="font-size:16px; font-weight:800; color:#0f172a; margin-top:4px;">${formattedDate}</div>
                  </td>
                </tr>
                ${isOptional ? `
                <tr>
                  <td colspan="2" style="padding:12px 20px; background:#fef3c7;">
                    <div style="font-size:12px; font-weight:600; color:#92400e; display:flex; align-items:center; gap:8px;">
                      <span style="font-size:16px;">📌</span>
                      This is an <strong>optional holiday</strong>. You may choose to take it off with manager approval.
                    </div>
                  </td>
                </tr>
                ` : ''}
                ${description ? `
                <tr>
                  <td colspan="2" style="padding:16px 20px;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Description</div>
                    <div style="font-size:14px; color:#475569; margin-top:4px;">${description}</div>
                  </td>
                </tr>
                ` : ''}
              </table>

              <div style="background:#f1f5f9; padding:16px 20px; border-radius:12px; margin-bottom:24px; border-left:4px solid #fbbf24;">
                <p style="margin:0; font-size:13px; color:#475569; line-height:1.6;">
                  📅 Please mark this on your calendar and plan your work accordingly.
                </p>
              </div>

              <a href="${frontendUrl}/holidays" style="display:block; text-align:center; background:#2563eb; color:white; text-decoration:none; padding:14px; border-radius:12px; font-weight:700; font-size:14px;">
                View Holiday Calendar →
              </a>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc; padding:24px 36px; text-align:center; border-radius:0 0 24px 24px;">
              <div style="font-size:10px; color:#94a3b8;">KUIPER HRMS • Automated Holiday Notification</div>
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

const getHolidayUpdatedTemplate = (data) => {
  const { oldName, newName, oldDate, newDate, oldIsOptional, newIsOptional, oldDescription, newDescription, frontendUrl } = data;

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

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
        <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; width:100%; background:#ffffff; border-radius:24px; box-shadow:0 4px 12px rgba(0,0,0,0.05); overflow:hidden;">
          <tr>
            <td style="padding:32px 36px; border-bottom:1px solid #e2e8f0;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding-right:12px; width:38px; vertical-align: middle;">
                    <img src="https://res.cloudinary.com/dhcwcyqke/image/upload/q_auto/f_auto/v1777631279/login_img_oycuic.png" alt="KUIPER" style="width:38px; height:38px; border-radius:10px; display:block;">
                  </td>
                  <td style="vertical-align: middle;">
                    <div style="font-size:20px; font-weight:800; color:#2563eb;">KUIPER</div>
                    <div style="font-size:8px; font-weight:600; color:#94a3b8; letter-spacing:0.25em; text-transform:uppercase; margin-top:3px;">Holiday Update</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#f59e0b; padding:28px 36px;">
              <div style="font-size:22px; font-weight:800; color:#78350f; margin-bottom:4px;">📝 Holiday Updated</div>
              <div style="font-size:13px; color:#92400e; font-weight:500;">A holiday has been modified</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 36px;">
              <p style="font-size:15px; margin:0 0 8px 0; line-height:1.6; color:#1e293b;">Dear Team,</p>
              <p style="font-size:14px; color:#475569; margin-bottom:24px; line-height:1.7;">
                The following holiday has been updated:
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; border-collapse: separate; margin-bottom:24px;">
                <tr style="background:#f1f5f9;">
                  <td width="50%" style="padding:12px 16px; border-bottom:1px solid #e2e8f0; border-right:1px solid #e2e8f0;">
                    <div style="font-size:9px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em;">Field</div>
                  </td>
                  <td width="25%" style="padding:12px 16px; border-bottom:1px solid #e2e8f0; border-right:1px solid #e2e8f0;">
                    <div style="font-size:9px; font-weight:700; color:#ef4444; text-transform:uppercase; letter-spacing:0.05em;">Previous</div>
                  </td>
                  <td width="25%" style="padding:12px 16px; border-bottom:1px solid #e2e8f0;">
                    <div style="font-size:9px; font-weight:700; color:#22c55e; text-transform:uppercase; letter-spacing:0.05em;">Updated</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 16px; border-bottom:1px solid #e2e8f0; border-right:1px solid #e2e8f0;">
                    <div style="font-size:10px; font-weight:700; color:#64748b;">Holiday Name</div>
                  </td>
                  <td style="padding:12px 16px; border-bottom:1px solid #e2e8f0; border-right:1px solid #e2e8f0;">
                    <div style="font-size:13px; font-weight:600; color:#ef4444;">${oldName}</div>
                  </td>
                  <td style="padding:12px 16px; border-bottom:1px solid #e2e8f0;">
                    <div style="font-size:13px; font-weight:600; color:#22c55e;">${newName}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 16px; border-bottom:1px solid #e2e8f0; border-right:1px solid #e2e8f0;">
                    <div style="font-size:10px; font-weight:700; color:#64748b;">Date</div>
                  </td>
                  <td style="padding:12px 16px; border-bottom:1px solid #e2e8f0; border-right:1px solid #e2e8f0;">
                    <div style="font-size:13px; font-weight:600; color:#ef4444;">${formatDate(oldDate)}</div>
                  </td>
                  <td style="padding:12px 16px; border-bottom:1px solid #e2e8f0;">
                    <div style="font-size:13px; font-weight:600; color:#22c55e;">${formatDate(newDate)}</div>
                  </td>
                </tr>
                ${oldIsOptional !== newIsOptional ? `
                <tr>
                  <td style="padding:12px 16px; border-bottom:1px solid #e2e8f0; border-right:1px solid #e2e8f0;">
                    <div style="font-size:10px; font-weight:700; color:#64748b;">Optional</div>
                  </td>
                  <td style="padding:12px 16px; border-bottom:1px solid #e2e8f0; border-right:1px solid #e2e8f0;">
                    <div style="font-size:13px; font-weight:600; color:#ef4444;">${oldIsOptional ? 'Yes' : 'No'}</div>
                  </td>
                  <td style="padding:12px 16px; border-bottom:1px solid #e2e8f0;">
                    <div style="font-size:13px; font-weight:600; color:#22c55e;">${newIsOptional ? 'Yes' : 'No'}</div>
                  </td>
                </tr>
                ` : ''}
                ${(oldDescription || '') !== (newDescription || '') ? `
                <tr>
                  <td style="padding:12px 16px; border-right:1px solid #e2e8f0;">
                    <div style="font-size:10px; font-weight:700; color:#64748b;">Description</div>
                  </td>
                  <td style="padding:12px 16px; border-right:1px solid #e2e8f0;">
                    <div style="font-size:12px; color:#ef4444;">${oldDescription || '—'}</div>
                  </td>
                  <td style="padding:12px 16px;">
                    <div style="font-size:12px; color:#22c55e;">${newDescription || '—'}</div>
                  </td>
                </tr>
                ` : ''}
              </table>

              <a href="${frontendUrl}/holidays" style="display:block; text-align:center; background:#2563eb; color:white; text-decoration:none; padding:14px; border-radius:12px; font-weight:700; font-size:14px;">
                View Updated Calendar →
              </a>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc; padding:24px 36px; text-align:center; border-radius:0 0 24px 24px;">
              <div style="font-size:10px; color:#94a3b8;">KUIPER HRMS • Automated Holiday Update</div>
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

const getHolidayDeletedTemplate = (data) => {
  const { name, date, frontendUrl } = data;

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
        <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; width:100%; background:#ffffff; border-radius:24px; box-shadow:0 4px 12px rgba(0,0,0,0.05); overflow:hidden;">
          <tr>
            <td style="padding:32px 36px; border-bottom:1px solid #e2e8f0;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding-right:12px; width:38px; vertical-align: middle;">
                    <img src="https://res.cloudinary.com/dhcwcyqke/image/upload/q_auto/f_auto/v1777631279/login_img_oycuic.png" alt="KUIPER" style="width:38px; height:38px; border-radius:10px; display:block;">
                  </td>
                  <td style="vertical-align: middle;">
                    <div style="font-size:20px; font-weight:800; color:#2563eb;">KUIPER</div>
                    <div style="font-size:8px; font-weight:600; color:#94a3b8; letter-spacing:0.25em; text-transform:uppercase; margin-top:3px;">Holiday Removed</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#ef4444; padding:28px 36px;">
              <div style="font-size:22px; font-weight:800; color:white; margin-bottom:4px;">🗑️ Holiday Removed</div>
              <div style="font-size:13px; color:#fca5a5; font-weight:500;">A holiday has been removed from the calendar</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 36px;">
              <p style="font-size:15px; margin:0 0 8px 0; line-height:1.6; color:#1e293b;">Dear Team,</p>
              <p style="font-size:14px; color:#475569; margin-bottom:24px; line-height:1.7;">
                The following holiday has been removed from the company calendar:
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; border-collapse: separate; margin-bottom:24px;">
                <tr>
                  <td width="50%" style="padding:16px 20px; border-bottom:1px solid #e2e8f0; border-right:1px solid #e2e8f0;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Holiday Name</div>
                    <div style="font-size:16px; font-weight:800; color:#0f172a; margin-top:4px;">${name}</div>
                  </td>
                  <td width="50%" style="padding:16px 20px; border-bottom:1px solid #e2e8f0;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Date</div>
                    <div style="font-size:16px; font-weight:800; color:#0f172a; margin-top:4px;">${date}</div>
                  </td>
                </tr>
              </table>

              <div style="background:#fef2f2; padding:16px 20px; border-radius:12px; margin-bottom:24px; border-left:4px solid #ef4444;">
                <p style="margin:0; font-size:13px; color:#991b1b; line-height:1.6;">
                  ⚠️ This holiday is no longer observed. Please update your plans accordingly.
                </p>
              </div>

              <a href="${frontendUrl}/holidays" style="display:block; text-align:center; background:#2563eb; color:white; text-decoration:none; padding:14px; border-radius:12px; font-weight:700; font-size:14px;">
                View Updated Calendar →
              </a>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc; padding:24px 36px; text-align:center; border-radius:0 0 24px 24px;">
              <div style="font-size:10px; color:#94a3b8;">KUIPER HRMS • Automated Holiday Removal</div>
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
  getHolidayCreatedTemplate,
  getHolidayUpdatedTemplate,
  getHolidayDeletedTemplate
};