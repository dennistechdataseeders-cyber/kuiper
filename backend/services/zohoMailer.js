const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async ({ to, subject, html }) => {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Kuiper CRM <no-reply@kuiperapp.co.in>',
      to,
      subject,
      html
    });
    if (error) throw new Error(JSON.stringify(error));
    console.log('✅ EMAIL SENT:', data.id);
    return data;
  } catch (error) {
    console.error('❌ EMAIL ERROR:', error.message);
    throw error;
  }
};

module.exports = sendEmail;