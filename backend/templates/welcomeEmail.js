// backend/templates/welcomeEmail.js
const getWelcomeTemplate = (name, email, resetUrl, role) => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return `
<html>
<body style="margin:0; padding:40px; font-family: sans-serif; background:#f8fafc; color:#1e293b;">
<div style="max-width:540px; margin:auto; padding:32px; border-radius:16px; background:white; border:1px solid #e2e8f0;">
  <div style="font-size:14px; font-weight:600; color:#0f172a; text-transform:uppercase; letter-spacing:0.1em;">KUIPER</div>
  <h2 style="margin-top:20px; font-size:18px; color:#0f172a;">Welcome, ${name}</h2>
  <p style="font-size:14px; color:#475569; line-height:1.6;">
    An account has been created for you as a <b>${role}</b>. 
    To activate your account, please set your password using the link below. 
    <br><br>
    <span style="color: #ef4444; font-weight: bold;">Note: This link expires in 30 minutes.</span>
  </p>
  <div style="text-align:center; margin:30px 0;">
    <a href="${resetUrl}" style="background:#2563eb; color:white; padding:14px 28px; text-decoration:none; border-radius:10px; font-weight:600; display:inline-block;">
      Set Your Password
    </a>
  </div>
  <p style="font-size:11px; color:#94a3b8; text-align:center;">
    If the button doesn't work, copy this: <br/> ${resetUrl}
  </p>
</div>
</body>
</html>`;
};

module.exports = getWelcomeTemplate;