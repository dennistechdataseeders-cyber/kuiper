// templates/welcomeEmail.js

const getWelcomeTemplate = (name, email, password, role) => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return `
<html>
<body style="margin:0; padding:40px; font-family: 'Segoe UI', Arial, sans-serif; background:#f8fafc; color:#1e293b;">

<div style="
  max-width:540px;
  margin:auto;
  padding:32px;
  border-radius:16px;
  background:white;
  border:1px solid #e2e8f0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
">

  <!-- MINIMAL HEADER -->
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:32px;">
    <tr>
      <td align="left" style="vertical-align: middle; width: 45px;">
        <div style="
          width:40px;
          height:40px;
          background:#f1f5f9;
          border:1px solid #e2e8f0;
          border-radius:10px;
          display:flex;
          align-items:center;
          justify-content:center;
        ">
          <img src="https://res.cloudinary.com/dhcwcyqke/image/upload/q_auto/f_auto/v1777631279/login_img_oycuic.png"
               style="width:44px; height:44px; object-fit:contain; border-radius:10px">
        </div>
      </td>
      <td align="left" style="padding-left:12px; vertical-align: middle;">
        <div style="font-size:14px; letter-spacing:0.15em; font-weight:600; color:#0f172a; text-transform:uppercase;">
          KUIPER
        </div>
        <div style="font-size:8px; color:#64748b; letter-spacing:0.2em; text-transform:uppercase; margin-top:2px;">
          Engineered for Operations
        </div>
      </td>
      <td align="right" style="vertical-align: middle;">
        <div style="font-size:11px; color:#94a3b8; letter-spacing:0.05em;">
          ${currentDate}
        </div>
      </td>
    </tr>
  </table>

  <!-- SUBTLE ALERT CONTENT -->
  <div style="margin-bottom:28px;">
    <h2 style="margin:0; font-size:16px; font-weight:600; color:#0f172a; letter-spacing:0.02em;">
      Access Provisioned
    </h2>
    <p style="margin-top:8px; font-size:13px; color:#475569; line-height:1.5;">
        Your administrative access credentials have been generated within the KUIPER network.
    </p>
  </div>

  <!-- USER CONTEXT BOX -->
  <div style="
    background:#f8fafc;
    padding:16px;
    border-radius:10px;
    border:1px solid #e2e8f0;
    margin-bottom:20px;
  ">
    <table width="100%" border="0" cellspacing="0" cellpadding="0">
      <tr>
        <td style="font-size:13px; color:#0f172a; font-weight:600;">
          ${name}
        </td>
        <td align="right">
          <span style="
            font-size:10px; 
            color:#2563eb; 
            background:rgba(37,99,235,0.06); 
            padding:3px 10px; 
            border-radius:6px;
            border:1px solid rgba(37,99,235,0.1);
            font-weight: 600;
            text-transform: uppercase;
          ">
            ${role}
          </span>
        </td>
      </tr>
    </table>
  </div>

  <!-- MINIMAL CREDENTIALS GRID -->
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:32px;">
    <tr>
      <td width="50%" style="padding-right:8px;">
        <div style="background:#ffffff; padding:14px; border-radius:10px; border:1px solid #e2e8f0;">
          <div style="font-size:9px; color:#94a3b8; letter-spacing:0.05em; margin-bottom:4px; text-transform:uppercase; font-weight:bold;">Email</div>
          <div style="font-size:12px; color:#1e293b; word-break:break-all;">${email}</div>
        </div>
      </td>
      <td width="50%" style="padding-left:8px;">
        <div style="background:#ffffff; padding:14px; border-radius:10px; border:1px solid #e2e8f0;">
          <div style="font-size:9px; color:#94a3b8; letter-spacing:0.05em; margin-bottom:4px; text-transform:uppercase; font-weight:bold;">Temporary Password</div>
          <div style="font-size:12px; color:#2563eb; font-weight:700;">${password}</div>
        </div>
      </td>
    </tr>
  </table>

  <!-- PRIMARY ACTION BUTTON -->
  <div style="text-align:center;">
    <a href="https://your-app-link.com/login" style="
      background:#0f172a;
      color:#ffffff;
      padding:12px 30px;
      text-decoration:none;
      border-radius:10px;
      font-size:13px;
      font-weight:600;
      display:inline-block;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
    ">
      Access Dashboard
    </a>
  </div>

  <!-- SYSTEM FOOTER -->
  <div style="
    margin-top:40px;
    padding-top:20px;
    text-align:center;
  ">
    <p style="font-size:10px; color:#94a3b8; letter-spacing:0.02em; line-height: 1.6;">
      NETWORK ENCLOSURE: SEC-AUTH-01<br/>
      Automated system transmission. KUIPER Systems &copy; 2026
    </p>
  </div>

</div>
</body>
</html>
  `;
};

module.exports = getWelcomeTemplate;