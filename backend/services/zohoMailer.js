const nodemailer =
  require('nodemailer');

const EMAIL =
  process.env.ZOHO_EMAIL;

const PASSWORD =
  process.env.ZOHO_APP_PASSWORD;

const transporter =
  nodemailer.createTransport({

    host: 'smtp.zoho.in',

    port: 465,

    secure: true,

    auth: {
      user: EMAIL,
      pass: PASSWORD
    }

  });

const sendEmail = async ({
  to,
  subject,
  html
}) => {

  try {

    const info =
      await transporter.sendMail({

        from:
          `"Kuiper CRM" <${EMAIL}>`,

        to,

        subject,

        html

      });

    console.log(
      'EMAIL SENT:',
      info.messageId
    );

    return info;

  } catch (error) {

    console.error(
      'EMAIL ERROR:',
      error
    );

    throw error;

  }

};

module.exports =
  sendEmail;