// backend/cron/dailyProductivityReport.js

const cron = require('node-cron');
const sendEmail = require('../services/zohoMailer');
const productivityService = require('../services/productivityReportService');
const {
  getDeveloperEmailTemplate,
  getSalesPersonEmailTemplate,
  getPMEmailTemplate,
  getSalesManagerEmailTemplate
} = require('../templates/productivityEmailTemplates');

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://kuiperapp.co.in';

/**
 * Send daily productivity report at 12:00 PM IST
 * Run: 0 12 * * *
 *
 * Rules:
 *   - Developers with 0 open tickets AND 0 feasibility tickets → skipped
 *   - Sales with 0 follow-ups AND 0 pending feasibility       → skipped
 *   - PMs with 0 unresolved tickets                           → skipped
 *   - Sales Managers always get their report (they audit the team)
 */
cron.schedule('00 12 * * *', async () => {
  console.log('📊 Starting daily productivity report...');
  const startTime = Date.now();

  try {
    // Get all report data
    const reportData = await productivityService.getCompleteReport();

    console.log(
      `✅ Report data generated for ` +
      `${reportData.developers.length} developers, ` +
      `${reportData.salesPeople.length} sales, ` +
      `${reportData.projectManagers.length} PMs, ` +
      `${reportData.salesManagers.length} sales managers`
    );

    // ============================================
    // SEND TO DEVELOPERS
    //   ✅ Skip any developer who has no open tickets
    //      AND no pending feasibility tickets.
    // ============================================
    let devEmailsSent = 0;
    let devEmailsSkipped = 0;

    for (const dev of reportData.developers) {
      const openCount = dev.openTicketsCount || 0;
      const feasCount = dev.feasibilityTicketsCount || 0;

      if (openCount === 0 && feasCount === 0) {
        console.log(`⏭️  Skipping developer ${dev.email} — no open or feasibility tickets`);
        devEmailsSkipped++;
        continue;
      }

      try {
        const html = getDeveloperEmailTemplate(dev, FRONTEND_URL);
        await sendEmail({
          to: dev.email,
          subject: `📊 Daily Developer Report - ${new Date().toLocaleDateString()}`,
          html: html
        });
        console.log(`📧 Developer email sent to: ${dev.email} (${openCount} open, ${feasCount} feasibility)`);
        devEmailsSent++;
      } catch (err) {
        console.error(`❌ Failed to send email to developer ${dev.email}:`, err.message);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`📧 Developer report summary: ${devEmailsSent} sent, ${devEmailsSkipped} skipped (no work)`);

    // ============================================
    // SEND TO SALES PEOPLE
    //   ✅ Skip any sales rep who has no follow-ups
    //      AND no pending feasibility.
    // ============================================
    let salesEmailsSent = 0;
    let salesEmailsSkipped = 0;

    for (const sales of reportData.salesPeople) {
      const followUps = sales.totalFollowUps || 0;
      const feasCount = sales.pendingFeasibility || 0;

      if (followUps === 0 && feasCount === 0) {
        console.log(`⏭️  Skipping sales rep ${sales.email} — no follow-ups or feasibility`);
        salesEmailsSkipped++;
        continue;
      }

      try {
        const html = getSalesPersonEmailTemplate(sales, FRONTEND_URL);
        await sendEmail({
          to: sales.email,
          subject: `📊 Daily Sales Report - ${new Date().toLocaleDateString()}`,
          html: html
        });
        console.log(`📧 Sales email sent to: ${sales.email} (${followUps} follow-ups, ${feasCount} feasibility)`);
        salesEmailsSent++;
      } catch (err) {
        console.error(`❌ Failed to send email to sales ${sales.email}:`, err.message);
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`📧 Sales report summary: ${salesEmailsSent} sent, ${salesEmailsSkipped} skipped (no work)`);

    // ============================================
    // SEND TO PROJECT MANAGERS
    //   ✅ Skip any PM who has no unresolved tickets.
    // ============================================
    let pmEmailsSent = 0;
    let pmEmailsSkipped = 0;

    for (const pm of reportData.projectManagers) {
      const unresolved = pm.unresolvedTicketsCount || 0;

      if (unresolved === 0) {
        console.log(`⏭️  Skipping PM ${pm.email} — no unresolved tickets`);
        pmEmailsSkipped++;
        continue;
      }

      try {
        const html = getPMEmailTemplate(pm, FRONTEND_URL);
        await sendEmail({
          to: pm.email,
          subject: `📊 Daily PM Report - ${new Date().toLocaleDateString()}`,
          html: html
        });
        console.log(`📧 PM email sent to: ${pm.email} (${unresolved} unresolved tickets)`);
        pmEmailsSent++;
      } catch (err) {
        console.error(`❌ Failed to send email to PM ${pm.email}:`, err.message);
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`📧 PM report summary: ${pmEmailsSent} sent, ${pmEmailsSkipped} skipped (no work)`);

    // ============================================
    // SEND TO SALES MANAGERS
    //   Always sent — the manager is auditing the team,
    //   so an "all quiet" report is still meaningful.
    // ============================================
    let managerEmailsSent = 0;

    for (const manager of reportData.salesManagers) {
      try {
        const html = getSalesManagerEmailTemplate(manager, FRONTEND_URL);
        await sendEmail({
          to: manager.email,
          subject: `📊 Daily Sales Manager Report - ${new Date().toLocaleDateString()}`,
          html: html
        });
        console.log(`📧 Sales Manager email sent to: ${manager.email}`);
        managerEmailsSent++;
      } catch (err) {
        console.error(`❌ Failed to send email to sales manager ${manager.email}:`, err.message);
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`📧 Sales Manager report summary: ${managerEmailsSent} sent`);

    // ============================================
    // DONE
    // ============================================
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Daily productivity report completed in ${duration}s`);

  } catch (error) {
    console.error('❌ Daily productivity report failed:', error.message);
  }
}, {
  timezone: "Asia/Kolkata"
});

console.log('⏰ Daily productivity report scheduled (12:00 PM IST)');