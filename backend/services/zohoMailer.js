const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async ({ to, subject, html }) => {
  try {
    // Validate email addresses
    if (!to || !Array.isArray(to) && typeof to !== 'string') {
      console.error('Invalid email recipient:', to);
      return { error: 'Invalid email recipient' };
    }
    
    // Ensure 'to' is an array for Resend
    const recipients = Array.isArray(to) ? to : [to];
    
    console.log(`📧 Sending email to: ${recipients.join(', ')}`);
    console.log(`   Subject: ${subject}`);
    
    const { data, error } = await resend.emails.send({
      from: 'Kuiper CRM <no-reply@kuiperapp.co.in>',
      to: recipients,
      subject,
      html
    });
    
    if (error) {
      console.error('❌ Resend error:', error);
      throw new Error(JSON.stringify(error));
    }
    
    console.log('✅ EMAIL SENT:', data.id);
    return data;
  } catch (error) {
    console.error('❌ EMAIL ERROR:', error.message);
    throw error;
  }
};

module.exports = sendEmail;