// backend/templates/leaveBalanceEmailTemplates.js

const getLeaveBalanceAdjustedTemplate = (data) => {
  const {
    employeeName,
    previousBalance,
    newBalance,
    change,
    reason,
    adjustedByName,
    adjustedAt,
    frontendUrl
  } = data;

  const isCredit = change > 0;
  const isDebit = change < 0;
  const isNoChange = change === 0;

  const changeLabel = isCredit
    ? `+${change} day${change === 1 ? '' : 's'} added`
    : isDebit
    ? `${change} day${change === -1 ? '' : 's'} deducted`
    : 'No change';

  const accentColor = isCredit ? '#10b981' : isDebit ? '#ef4444' : '#64748b';
  const accentBg = isCredit ? '#ecfdf5' : isDebit ? '#fef2f2' : '#f8fafc';
  const accentBorder = isCredit ? '#a7f3d0' : isDebit ? '#fecaca' : '#e2e8f0';

  const formattedDate = adjustedAt
    ? new Date(adjustedAt).toLocaleString('en-US', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'N/A';

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
                    <div style="font-size:8px; font-weight:600; color:#94a3b8; letter-spacing:0.25em; text-transform:uppercase; margin-top:3px;">Leave Management System</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Banner -->
          <tr>
            <td style="background:${accentBg}; padding:28px 36px; border-bottom:1px solid ${accentBorder};">
              <div style="font-size:12px; font-weight:700; color:${accentColor}; letter-spacing:0.06em; text-transform:uppercase;">Leave Balance Updated</div>
              <div style="font-size:26px; font-weight:800; color:#0f172a; margin-top:6px;">${changeLabel}</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">
              <p style="font-size:15px; margin:0 0 20px 0; line-height:1.6; color:#1e293b;">
                Dear <strong>${employeeName}</strong>,
              </p>
              <p style="font-size:14px; color:#475569; margin-bottom:24px; line-height:1.7;">
                Your <strong>Paid Leave</strong> balance has been updated by the HR team. Please review the details below.
              </p>

              <!-- Balance change box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; border-collapse: separate; margin-bottom:24px;">
                <tr>
                  <td width="33%" style="padding:18px 16px; border-right:1px solid #e2e8f0; text-align:center; vertical-align: middle;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Previous</div>
                    <div style="font-size:26px; font-weight:800; color:#334155; margin-top:6px;">${previousBalance}</div>
                    <div style="font-size:10px; color:#94a3b8; margin-top:2px;">days</div>
                  </td>
                  <td width="33%" style="padding:18px 16px; border-right:1px solid #e2e8f0; text-align:center; vertical-align: middle; background:${accentBg};">
                    <div style="font-size:10px; font-weight:700; color:${accentColor}; text-transform:uppercase; letter-spacing:0.05em;">Change</div>
                    <div style="font-size:26px; font-weight:800; color:${accentColor}; margin-top:6px;">
                      ${change > 0 ? '+' : ''}${change}
                    </div>
                    <div style="font-size:10px; color:${accentColor}; margin-top:2px;">days</div>
                  </td>
                  <td width="33%" style="padding:18px 16px; text-align:center; vertical-align: middle;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">New Balance</div>
                    <div style="font-size:26px; font-weight:800; color:#0f172a; margin-top:6px;">${newBalance}</div>
                    <div style="font-size:10px; color:#94a3b8; margin-top:2px;">days</div>
                  </td>
                </tr>
              </table>

              <!-- Reason -->
              <div style="background:#f1f5f9; padding:18px 22px; border-radius:12px; border-left:4px solid ${accentColor}; margin-bottom:20px;">
                <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:6px;">
                  Reason Provided by HR
                </div>
                <p style="margin:0; font-size:14px; line-height:1.6; color:#334155;">${reason}</p>
              </div>

              <!-- Meta -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; border-collapse: separate; margin-bottom:24px;">
                <tr>
                  <td width="50%" style="padding:12px 16px; border-right:1px solid #e2e8f0;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase;">Adjusted By</div>
                    <div style="font-size:13px; font-weight:700; color:#1e293b; margin-top:2px;">${adjustedByName || 'HR'}</div>
                  </td>
                  <td width="50%" style="padding:12px 16px;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase;">Date</div>
                    <div style="font-size:13px; font-weight:600; color:#1e293b; margin-top:2px;">${formattedDate}</div>
                  </td>
                </tr>
              </table>

              <a href="${frontendUrl}/employee/leave" style="display:block; text-align:center; background:${accentColor}; color:white; text-decoration:none; padding:14px; border-radius:12px; font-weight:700; font-size:14px;">
                View My Leave Dashboard →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc; padding:24px 36px; text-align:center; border-radius:0 0 24px 24px;">
              <div style="font-size:10px; color:#94a3b8;">KUIPER HRMS • Automated Leave Balance Notification</div>
              <div style="font-size:9px; color:#cbd5e1; margin-top:2px;">If you believe this is incorrect, please contact your HR team.</div>
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

module.exports = { getLeaveBalanceAdjustedTemplate };