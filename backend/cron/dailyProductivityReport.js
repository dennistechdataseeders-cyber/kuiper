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
 * Send daily productivity report at 11:00 AM IST
 * Run: 0 11 * * *
 */
cron.schedule('00 12 * * *', async () => {
  console.log('📊 Starting daily productivity report...');
  const startTime = Date.now();

  try {
    // Get all report data
    const reportData = await productivityService.getCompleteReport();
    console.log(`✅ Report data generated for ${reportData.developers.length} developers, ${reportData.salesPeople.length} sales, ${reportData.projectManagers.length} PMs`);

    // ============================================
    // SEND TO DEVELOPERS
    // ============================================
    for (const dev of reportData.developers) {
      try {
        const html = getDeveloperEmailTemplate(dev, FRONTEND_URL);
        await sendEmail({
          to: dev.email,
          subject: `📊 Daily Developer Report - ${new Date().toLocaleDateString()}`,
          html: html
        });
        console.log(`📧 Developer email sent to: ${dev.email}`);
      } catch (err) {
        console.error(`❌ Failed to send email to developer ${dev.email}:`, err.message);
      }
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // ============================================
    // SEND TO SALES PEOPLE
    // ============================================
    for (const sales of reportData.salesPeople) {
      try {
        const html = getSalesPersonEmailTemplate(sales, FRONTEND_URL);
        await sendEmail({
          to: sales.email,
          subject: `📊 Daily Sales Report - ${new Date().toLocaleDateString()}`,
          html: html
        });
        console.log(`📧 Sales email sent to: ${sales.email}`);
      } catch (err) {
        console.error(`❌ Failed to send email to sales ${sales.email}:`, err.message);
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // ============================================
    // SEND TO PROJECT MANAGERS
    // ============================================
    for (const pm of reportData.projectManagers) {
      try {
        const html = getPMEmailTemplate(pm, FRONTEND_URL);
        await sendEmail({
          to: pm.email,
          subject: `📊 Daily PM Report - ${new Date().toLocaleDateString()}`,
          html: html
        });
        console.log(`📧 PM email sent to: ${pm.email}`);
      } catch (err) {
        console.error(`❌ Failed to send email to PM ${pm.email}:`, err.message);
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // ============================================
    // SEND TO SALES MANAGERS
    // ============================================
    for (const manager of reportData.salesManagers) {
      try {
        const html = getSalesManagerEmailTemplate(manager, FRONTEND_URL);
        await sendEmail({
          to: manager.email,
          subject: `📊 Daily Sales Manager Report - ${new Date().toLocaleDateString()}`,
          html: html
        });
        console.log(`📧 Sales Manager email sent to: ${manager.email}`);
      } catch (err) {
        console.error(`❌ Failed to send email to sales manager ${manager.email}:`, err.message);
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Daily productivity report completed in ${duration}s`);

  } catch (error) {
    console.error('❌ Daily productivity report failed:', error.message);
  }
}, {
  timezone: "Asia/Kolkata"
});

console.log('⏰ Daily productivity report scheduled (11:00 AM IST)');