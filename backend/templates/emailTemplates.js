const emailTemplates = {

  welcome: [

    /*
    ========================================
    STEP 1
    ========================================
    */

    {
      subject:
        'Quick question about your team workflow',

      html: `
        <div style="font-family:Arial,sans-serif;color:#1e293b;line-height:1.8;padding:20px;max-width:650px;">

          <p>
            Hi {{name}},
          </p>

          <p>
            I was reaching out because many growing teams struggle with tracking projects, employee productivity, and operational workflows efficiently.
          </p>

          <p>
            We recently built <strong>Kuiper</strong>, a lightweight platform designed to help businesses simplify:
          </p>

          <p>
            • Project tracking<br/>
            • Team monitoring<br/>
            • Workflow automation<br/>
            • Productivity reporting
          </p>

          <p>
            The goal is to reduce manual coordination and improve visibility across teams.
          </p>

          <p>
            Would you be open to a short 10-minute walkthrough sometime this week?
          </p>

          <br/>

          <p>
            Regards,<br/>
            Rahul<br/>
            Kuiper
          </p>

          <p style="font-size:12px;color:#64748b;margin-top:30px;">
            If you'd prefer not to receive further emails, simply reply with "unsubscribe".
          </p>

        </div>
      `
    },

    /*
    ========================================
    STEP 2
    ========================================
    */

    {
      subject:
        'Following up regarding workflow visibility',

      html: `
        <div style="font-family:Arial,sans-serif;color:#1e293b;line-height:1.8;padding:20px;max-width:650px;">

          <p>
            Hello {{name}},
          </p>

          <p>
            Just following up on my previous email.
          </p>

          <p>
            One of the common problems teams face is lack of visibility into:
          </p>

          <p>
            • Task progress<br/>
            • Employee productivity<br/>
            • Time spent on operations<br/>
            • Reporting and accountability
          </p>

          <p>
            Kuiper helps centralize all of this into one dashboard so managers can monitor workflows without constant follow-ups.
          </p>

          <p>
            Happy to share a quick overview if this is relevant for your team.
          </p>

          <br/>

          <p>
            Regards,<br/>
            Rahul
          </p>

          <p style="font-size:12px;color:#64748b;margin-top:30px;">
            Reply "unsubscribe" if you'd prefer not to hear from us again.
          </p>

        </div>
      `
    },

    /*
    ========================================
    STEP 3
    ========================================
    */

    {
      subject:
        'A quick idea to improve operational efficiency',

      html: `
        <div style="font-family:Arial,sans-serif;color:#1e293b;line-height:1.8;padding:20px;max-width:650px;">

          <p>
            Hi {{name}},
          </p>

          <p>
            We’ve noticed that companies often lose significant time handling repetitive operational tracking manually.
          </p>

          <p>
            Kuiper was designed to simplify this by helping teams:
          </p>

          <p>
            • Track employee activity<br/>
            • Generate reports automatically<br/>
            • Monitor workflows in real time<br/>
            • Improve team accountability
          </p>

          <p>
            The platform is intentionally simple and lightweight so teams can start using it quickly.
          </p>

          <p>
            Let me know if you'd like me to share a quick demo link.
          </p>

          <br/>

          <p>
            Regards,<br/>
            Rahul
          </p>

          <p style="font-size:12px;color:#64748b;margin-top:30px;">
            Reply "unsubscribe" to opt out of future emails.
          </p>

        </div>
      `
    },

    /*
    ========================================
    STEP 4
    ========================================
    */

    {
      subject:
        'Reducing manual operational work',

      html: `
        <div style="font-family:Arial,sans-serif;color:#1e293b;line-height:1.8;padding:20px;max-width:650px;">

          <p>
            Hello {{name}},
          </p>

          <p>
            One thing we consistently hear from growing businesses is how much time gets spent managing workflows manually.
          </p>

          <p>
            Kuiper helps automate operational tracking and reporting so teams can spend more time executing instead of coordinating.
          </p>

          <p>
            Some teams use it for:
          </p>

          <p>
            • Project visibility<br/>
            • Employee tracking<br/>
            • Daily reporting<br/>
            • Workflow management
          </p>

          <p>
            If improving operational efficiency is currently a priority, I’d be happy to show how it works.
          </p>

          <br/>

          <p>
            Regards,<br/>
            Rahul
          </p>

          <p style="font-size:12px;color:#64748b;margin-top:30px;">
            Reply "unsubscribe" if you'd like to stop receiving these emails.
          </p>

        </div>
      `
    },

    /*
    ========================================
    STEP 5
    ========================================
    */

    {
      subject:
        'How teams are simplifying project management',

      html: `
        <div style="font-family:Arial,sans-serif;color:#1e293b;line-height:1.8;padding:20px;max-width:650px;">

          <p>
            Hi {{name}},
          </p>

          <p>
            Many teams currently use multiple disconnected tools for project tracking, reporting, and employee monitoring.
          </p>

          <p>
            Kuiper combines these workflows into one centralized system, helping managers maintain visibility without increasing operational overhead.
          </p>

          <p>
            The focus is on simplicity, accountability, and smoother workflow management.
          </p>

          <p>
            Let me know if you'd be interested in exploring it further.
          </p>

          <br/>

          <p>
            Regards,<br/>
            Rahul
          </p>

          <p style="font-size:12px;color:#64748b;margin-top:30px;">
            Reply "unsubscribe" to opt out anytime.
          </p>

        </div>
      `
    },

    /*
    ========================================
    STEP 6
    ========================================
    */

    {
      subject:
        'Final follow-up from Rahul',

      html: `
        <div style="font-family:Arial,sans-serif;color:#1e293b;line-height:1.8;padding:20px;max-width:650px;">

          <p>
            Hi {{name}},
          </p>

          <p>
            I wanted to send one final follow-up regarding Kuiper.
          </p>

          <p>
            If improving workflow visibility, employee accountability, and operational efficiency is something your team is currently exploring, I’d be happy to share more details.
          </p>

          <p>
            No pressure either way — just thought it might be relevant based on the kinds of operational challenges many growing teams face today.
          </p>

          <p>
            Thanks for your time.
          </p>

          <br/>

          <p>
            Regards,<br/>
            Rahul<br/>
            Kuiper
          </p>

          <p style="font-size:12px;color:#64748b;margin-top:30px;">
            Reply "unsubscribe" if you no longer wish to receive emails from us.
          </p>

        </div>
      `
    }

  ]

};

module.exports = emailTemplates;