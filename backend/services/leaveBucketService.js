// backend/services/leaveBucketService.js - COMPLETE FIXED FILE
// INCLUDES: Email notifications to HR + dhaval@techdataseeders.in

const LeaveBucket = require('../models/LeaveBucket');
const LeaveApplication = require('../models/LeaveApplication');
const User = require('../models/User');
const sendEmail = require('./zohoMailer');
const mongoose = require('mongoose');

class LeaveBucketService {

  getISTDate() {
    const now = new Date();
    return new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  }

  getFinancialYear(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth();

    if (month >= 3) {
      return { startYear: year, endYear: year + 1 };
    } else {
      return { startYear: year - 1, endYear: year };
    }
  }

  async getOrCreateBucket(employeeId) {
    let bucket = await LeaveBucket.findOne({ employeeId });

    if (!bucket) {
      bucket = new LeaveBucket({
        employeeId,
        totalBalance: 0,
        leavesTakenThisMonth: 0,
        leavesTakenThisYear: 0,
        lastAccrualMonth: -1,
        lastAccrualYear: -1,
        monthlyUsage: [],
        yearlyUsage: []
      });
      await bucket.save();
    }

    return bucket;
  }

  async accrueMonthlyLeaves() {
    const istDate = this.getISTDate();
    const currentMonth = istDate.getMonth();
    const currentYear = istDate.getFullYear();
    const day = istDate.getDate();

    if (day !== 1) {
      console.log(`📅 Not the 1st of the month (day: ${day}). Skipping accrual.`);
      return { success: false, message: 'Not the 1st of the month' };
    }

    console.log(`📊 Running monthly leave accrual for ${istDate.toISOString().split('T')[0]}`);

    const employees = await User.find({
      isActive: true,
      role: { $nin: ['Admin', 'HR', 'Client', 'Super Admin'] }
    }).select('_id name email role isProbationary dateOfJoining');

    let accruedCount = 0;
    let skippedCount = 0;
    const results = [];

    for (const employee of employees) {
      try {
        const bucket = await this.getOrCreateBucket(employee._id);

        if (bucket.lastAccrualMonth === currentMonth && bucket.lastAccrualYear === currentYear) {
          console.log(`ℹ️ ${employee.name} already accrued for ${currentMonth}/${currentYear}`);
          skippedCount++;
          continue;
        }

        const financialYear = this.getFinancialYear(istDate);
        const financialYearStart = new Date(financialYear.startYear, 3, 1);
        const financialYearEnd = new Date(financialYear.endYear, 2, 31);

        if (currentMonth === 3 && day === 1) {
          console.log(`📅 April 1st - Resetting yearly balance for ${employee.name}`);
          bucket.totalBalance = 0;
          bucket.leavesTakenThisYear = 0;
          bucket.financialYearStart = financialYearStart;
          bucket.financialYearEnd = financialYearEnd;
          bucket.monthlyUsage = [];
          bucket.yearlyUsage = [];
        }

        const accrualAmount = 1.5;
        bucket.totalBalance += accrualAmount;
        bucket.lastAccrualMonth = currentMonth;
        bucket.lastAccrualYear = currentYear;

        const existingMonth = bucket.monthlyUsage.find(
          m => m.month === currentMonth && m.year === currentYear
        );
        if (existingMonth) {
          existingMonth.leavesAccrued += accrualAmount;
        } else {
          bucket.monthlyUsage.push({
            month: currentMonth,
            year: currentYear,
            leavesTaken: 0,
            leavesAccrued: accrualAmount
          });
        }

        const existingYear = bucket.yearlyUsage.find(
          y => y.year === financialYear.startYear
        );
        if (existingYear) {
          existingYear.leavesAccrued += accrualAmount;
        } else {
          bucket.yearlyUsage.push({
            year: financialYear.startYear,
            leavesTaken: 0,
            leavesAccrued: accrualAmount
          });
        }

        await bucket.save();
        accruedCount++;
        console.log(`✅ Accrued ${accrualAmount} days for ${employee.name} (Total: ${bucket.totalBalance})`);

        results.push({
          employee: employee.name,
          email: employee.email,
          accrual: accrualAmount,
          totalBalance: bucket.totalBalance,
          isProbationary: employee.isProbationary || false
        });

      } catch (error) {
        console.error(`❌ Error accruing leaves for ${employee.name}:`, error.message);
      }
    }

    console.log(`📊 Accrual complete: ${accruedCount} employees, ${skippedCount} skipped`);

    return {
      success: true,
      accruedCount,
      skippedCount,
      results
    };
  }

  async hasExceededMonthlyLimit(employeeId, requestedDays) {
    const istDate = this.getISTDate();
    const currentMonth = istDate.getMonth();
    const currentYear = istDate.getFullYear();

    const bucket = await this.getOrCreateBucket(employeeId);

    const monthlyRecord = bucket.monthlyUsage.find(
      m => m.month === currentMonth && m.year === currentYear
    );

    const leavesTakenThisMonth = monthlyRecord ? monthlyRecord.leavesTaken : 0;
    const totalRequested = leavesTakenThisMonth + requestedDays;
    const MAX_DAYS_PER_MONTH = 4;

    if (totalRequested > MAX_DAYS_PER_MONTH) {
      return {
        exceeded: true,
        currentMonthUsage: leavesTakenThisMonth,
        requested: requestedDays,
        maxAllowed: MAX_DAYS_PER_MONTH,
        remaining: MAX_DAYS_PER_MONTH - leavesTakenThisMonth
      };
    }

    return {
      exceeded: false,
      currentMonthUsage: leavesTakenThisMonth,
      requested: requestedDays,
      maxAllowed: MAX_DAYS_PER_MONTH,
      remaining: MAX_DAYS_PER_MONTH - leavesTakenThisMonth
    };
  }

  // ============================================
  // ✅ FIXED: applyForLeave with email notification to HR + Dhaval
  // ============================================
  async applyForLeave(employeeId, leaveType, startDate, endDate, isHalfDay, halfDayType, reason) {
    const istDate = this.getISTDate();
    const days = isHalfDay ? 0.5 : this.calculateDays(startDate, endDate);

    const employee = await User.findById(employeeId).select('isProbationary probationEndDate name email');
    if (!employee) {
      throw new Error('Employee not found');
    }

    const isProbationary = employee.isProbationary || false;

    if (isProbationary && leaveType !== 'Unpaid Leave') {
      throw new Error('Employees on probation can only take Unpaid Leave');
    }

    const bucket = await this.getOrCreateBucket(employeeId);

    const monthlyCheck = await this.hasExceededMonthlyLimit(employeeId, days);
    if (monthlyCheck.exceeded) {
      throw new Error(
        `Cannot take ${days} days. You've already taken ${monthlyCheck.currentMonthUsage} days this month. ` +
        `Maximum allowed is ${monthlyCheck.maxAllowed} days. Remaining: ${monthlyCheck.remaining} days.`
      );
    }

    if (leaveType === 'Paid Leave') {
      if (bucket.totalBalance < days) {
        throw new Error(`Insufficient Paid Leave balance. Available: ${bucket.totalBalance}, Requested: ${days}`);
      }
    }

    const overlapping = await LeaveApplication.findOne({
      employeeId,
      status: { $in: ['pending', 'approved'] },
      $or: [
        { startDate: { $lte: new Date(endDate) }, endDate: { $gte: new Date(startDate) } },
        { startDate: { $gte: new Date(startDate), $lte: new Date(endDate) } },
        { endDate: { $gte: new Date(startDate), $lte: new Date(endDate) } }
      ]
    });

    if (overlapping) {
      throw new Error('You already have a leave request overlapping with these dates');
    }

    const leaveApplication = new LeaveApplication({
      employeeId,
      leaveType,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isHalfDay: isHalfDay || false,
      halfDayType: isHalfDay ? (halfDayType || 'first') : null,
      reason: reason.trim(),
      status: 'pending',
      deductedFromBucket: false
    });

    await leaveApplication.save();

    // ============================================
    // ✅ FIX: SEND EMAIL NOTIFICATION TO HR + DHAVAL
    // ============================================
    await this.sendLeaveRequestEmail(leaveApplication, employee);

    return {
      success: true,
      leaveApplication,
      probationary: isProbationary,
      daysRequested: days,
      currentBalance: bucket.totalBalance,
      monthlyUsage: monthlyCheck.currentMonthUsage + days,
      monthlyRemaining: monthlyCheck.remaining - days
    };
  }

  // ============================================
  // ✅ NEW: Send leave request email to HR + Dhaval
  // ============================================
  async sendLeaveRequestEmail(leaveApplication, employee) {
    try {
      // Get all active HR users with valid emails
      const hrUsers = await User.find({
        role: 'HR',
        isActive: true,
        email: { $ne: null, $ne: '' }
      }).select('email name');

      // ============================================
      // ✅ ADD DHAVAL TO THE RECIPIENT LIST
      // ============================================
      const additionalRecipients = [
        { email: 'dhaval@techdataseeders.in', name: 'Dhaval' }
      ];

      // Combine HR users + Additional recipients
      const allRecipients = [
        ...hrUsers.map(hr => ({ email: hr.email, name: hr.name })),
        ...additionalRecipients
      ];

      // Remove duplicates (in case Dhaval is also in HR list)
      const uniqueRecipients = [];
      const seenEmails = new Set();
      for (const recipient of allRecipients) {
        if (!seenEmails.has(recipient.email)) {
          seenEmails.add(recipient.email);
          uniqueRecipients.push(recipient);
        }
      }

      if (uniqueRecipients.length === 0) {
        console.log('⚠️ No recipients found to notify about leave request');
        return;
      }

      console.log(`📧 Preparing to send leave notification to ${uniqueRecipients.length} recipient(s):`);
      uniqueRecipients.forEach(r => console.log(`   - ${r.email} (${r.name})`));

      const frontendUrl = process.env.FRONTEND_URL || 'https://kuiperapp.co.in';
      const leaveUrl = `${frontendUrl}/hr/leaves`;

      const days = leaveApplication.isHalfDay
        ? 0.5
        : this.calculateDays(leaveApplication.startDate, leaveApplication.endDate);

      const isProbationary = employee.isProbationary || false;

      // Generate a single email HTML template
      const emailHtml = `
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
        <table width="550" cellpadding="0" cellspacing="0" border="0" style="max-width:550px; width:100%; background:#ffffff; border-radius:24px; box-shadow:0 4px 12px rgba(0,0,0,0.05); overflow:hidden;">

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
            <td style="background:#f1f5f9; padding:28px 36px;">
              <div style="font-size:13px; font-weight:700; color:#475569; letter-spacing:0.06em; text-transform:uppercase;">Leave Request</div>
              <div style="font-size:26px; font-weight:800; color:#0f172a; margin-top:6px;">${leaveApplication.leaveType}</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">
              <p style="font-size:15px; margin-bottom:20px; color:#1e293b;">
                <strong>${employee.name}</strong> has requested leave:
                ${isProbationary ? `<span style="background:#fef3c7; color:#d97706; padding:2px 10px; border-radius:12px; font-size:10px; font-weight:700; margin-left:8px;">⚠️ Probation</span>` : ''}
              </p>

              <!-- Leave Details -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; border-collapse: separate; margin-bottom:24px;">
                <tr>
                  <td width="50%" style="padding:14px 18px; border-bottom:1px solid #e2e8f0; border-right:1px solid #e2e8f0;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Leave Type</div>
                    <div style="font-size:14px; font-weight:700; color:#1e293b; margin-top:2px;">${leaveApplication.leaveType}</div>
                  </td>
                  <td width="50%" style="padding:14px 18px; border-bottom:1px solid #e2e8f0;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Duration</div>
                    <div style="font-size:14px; font-weight:700; color:#1e293b; margin-top:2px;">${days} day${days > 1 ? 's' : ''}</div>
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding:14px 18px; border-right:1px solid #e2e8f0;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">From</div>
                    <div style="font-size:14px; font-weight:700; color:#1e293b; margin-top:2px;">${new Date(leaveApplication.startDate).toLocaleDateString()}</div>
                  </td>
                  <td width="50%" style="padding:14px 18px;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">To</div>
                    <div style="font-size:14px; font-weight:700; color:#1e293b; margin-top:2px;">${new Date(leaveApplication.endDate).toLocaleDateString()}</div>
                  </td>
                </tr>
                ${leaveApplication.isHalfDay ? `
                <tr>
                  <td colspan="2" style="padding:14px 18px;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Half Day</div>
                    <div style="font-size:14px; font-weight:700; color:#1e293b; margin-top:2px;">${leaveApplication.halfDayType === 'first' ? 'First Half' : 'Second Half'}</div>
                  </td>
                </tr>
                ` : ''}
                ${isProbationary ? `
                <tr>
                  <td colspan="2" style="padding:14px 18px; background:#fef3c7;">
                    <div style="font-size:10px; font-weight:700; color:#92400e; text-transform:uppercase; letter-spacing:0.05em;">⚠️ Probation Status</div>
                    <div style="font-size:13px; font-weight:600; color:#78350f; margin-top:2px;">Employee is on probation - only Unpaid Leave is allowed</div>
                  </td>
                </tr>
                ` : ''}
              </table>

              <!-- Reason -->
              <div style="background:#f8fafc; padding:16px 20px; border-radius:12px; margin-bottom:20px;">
                <div style="font-size:10px; font-weight:700; color:#64748
                                <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:6px;">Reason</div>
                <p style="margin:0; font-size:13px; line-height:1.5; color:#334155;">${leaveApplication.reason}</p>
              </div>

              <!-- Action Button -->
              <a href="${leaveUrl}" style="display:block; text-align:center; background:#2563eb; color:white; text-decoration:none; padding:14px; border-radius:12px; font-weight:700; font-size:13px;">
                Review Leave Request →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc; padding:20px 36px; text-align:center; border-radius:0 0 24px 24px;">
              <div style="font-size:10px; color:#94a3b8;">KUIPER HRMS • Automated Leave Notification</div>
              <div style="font-size:8px; color:#cbd5e1; margin-top:4px;">This is an automated notification. Please do not reply to this email.</div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `;

      // Send to each recipient (HR + Dhaval)
      let sentCount = 0;
      let failedCount = 0;

      for (const recipient of uniqueRecipients) {
        try {
          await sendEmail({
            to: recipient.email,
            subject: `📋 Leave Request: ${employee.name} - ${leaveApplication.leaveType}`,
            html: emailHtml
          });
          console.log(`📧 Leave request email sent to: ${recipient.email} (${recipient.name})`);
          sentCount++;
        } catch (err) {
          console.error(`❌ Failed to send leave email to ${recipient.email}:`, err.message);
          failedCount++;
        }

        // Small delay between emails to avoid rate limiting
        if (uniqueRecipients.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      console.log(`📧 Leave email summary: ${sentCount} sent, ${failedCount} failed`);

    } catch (error) {
      console.error('❌ Error sending leave request email:', error.message);
      // Don't throw - email failure shouldn't break the leave application
    }
  }

  async approveLeave(leaveId, approvedBy) {
    const leave = await LeaveApplication.findById(leaveId);
    if (!leave) {
      throw new Error('Leave application not found');
    }

    if (leave.status !== 'pending') {
      throw new Error('Leave already processed');
    }

    const days = leave.isHalfDay ? 0.5 : this.calculateDays(leave.startDate, leave.endDate);
    const employee = await User.findById(leave.employeeId);

    if (!employee) {
      throw new Error('Employee not found');
    }

    const isProbationary = employee.isProbationary || false;

    if (isProbationary && leave.leaveType !== 'Unpaid Leave') {
      throw new Error('Employees on probation can only take Unpaid Leave');
    }

    const bucket = await this.getOrCreateBucket(leave.employeeId);

    if (leave.leaveType === 'Paid Leave') {
      if (bucket.totalBalance < days) {
        throw new Error(`Insufficient balance. Available: ${bucket.totalBalance}, Required: ${days}`);
      }

      bucket.totalBalance -= days;
    }

    const istDate = this.getISTDate();
    const currentMonth = istDate.getMonth();
    const currentYear = istDate.getFullYear();

    const monthlyRecord = bucket.monthlyUsage.find(
      m => m.month === currentMonth && m.year === currentYear
    );
    if (monthlyRecord) {
      monthlyRecord.leavesTaken += days;
    } else {
      bucket.monthlyUsage.push({
        month: currentMonth,
        year: currentYear,
        leavesTaken: days,
        leavesAccrued: 0
      });
    }

    const financialYear = this.getFinancialYear(istDate);
    const currentFinancialYear = financialYear.startYear;

    const yearlyRecord = bucket.yearlyUsage.find(
      y => y.year === currentFinancialYear
    );
    if (yearlyRecord) {
      yearlyRecord.leavesTaken += days;
    } else {
      bucket.yearlyUsage.push({
        year: currentFinancialYear,
        leavesTaken: days,
        leavesAccrued: 0
      });
    }

    bucket.leavesTakenThisMonth = monthlyRecord ? monthlyRecord.leavesTaken : days;
    bucket.leavesTakenThisYear = yearlyRecord ? yearlyRecord.leavesTaken : days;

    await bucket.save();

    leave.status = 'approved';
    leave.approvedBy = approvedBy;
    leave.approvedAt = new Date();
    leave.deductedFromBucket = true;
    await leave.save();

    return {
      success: true,
      leave,
      daysDeducted: days,
      remainingBalance: bucket.totalBalance,
      monthlyUsage: bucket.leavesTakenThisMonth,
      yearlyUsage: bucket.leavesTakenThisYear
    };
  }

  async rejectLeave(leaveId, rejectionReason, approvedBy) {
    const leave = await LeaveApplication.findById(leaveId);
    if (!leave) {
      throw new Error('Leave application not found');
    }

    if (leave.status !== 'pending') {
      throw new Error('Leave already processed');
    }

    leave.status = 'rejected';
    leave.rejectionReason = rejectionReason.trim();
    leave.approvedBy = approvedBy;
    leave.approvedAt = new Date();
    leave.deductedFromBucket = false;
    await leave.save();

    return {
      success: true,
      leave
    };
  }

  async getEmployeeLeaveSummary(employeeId) {
    const bucket = await this.getOrCreateBucket(employeeId);
    const istDate = this.getISTDate();
    const currentMonth = istDate.getMonth();
    const currentYear = istDate.getFullYear();

    const monthlyRecord = bucket.monthlyUsage.find(
      m => m.month === currentMonth && m.year === currentYear
    );

    const financialYear = this.getFinancialYear(istDate);
    const yearlyRecord = bucket.yearlyUsage.find(
      y => y.year === financialYear.startYear
    );

    const pendingLeaves = await LeaveApplication.find({
      employeeId,
      status: 'pending'
    }).select('startDate endDate isHalfDay leaveType');

    const pendingDays = pendingLeaves.reduce((total, leave) => {
      const days = leave.isHalfDay ? 0.5 : this.calculateDays(leave.startDate, leave.endDate);
      return total + days;
    }, 0);

    return {
      totalBalance: bucket.totalBalance,
      leavesTakenThisMonth: monthlyRecord ? monthlyRecord.leavesTaken : 0,
      leavesTakenThisYear: yearlyRecord ? yearlyRecord.leavesTaken : 0,
      monthlyLimit: 4,
      remainingThisMonth: 4 - (monthlyRecord ? monthlyRecord.leavesTaken : 0),
      monthlyUsage: bucket.monthlyUsage,
      yearlyUsage: bucket.yearlyUsage,
      pendingLeaves: pendingLeaves.length,
      pendingDays: pendingDays,
      financialYear: {
        start: financialYear.startYear,
        end: financialYear.endYear
      }
    };
  }

  async adjustBalance(employeeId, newBalance, reason, adjustedBy) {
    if (newBalance === undefined || newBalance === null || isNaN(newBalance)) {
      throw new Error('A valid newBalance is required');
    }
    if (newBalance < 0) {
      throw new Error('Leave balance cannot be negative');
    }
    if (!reason || !reason.trim()) {
      throw new Error('A reason is required for a balance adjustment');
    }

    const bucket = await this.getOrCreateBucket(employeeId);
    const previousBalance = bucket.totalBalance;

    bucket.totalBalance = newBalance;
    bucket.adjustmentHistory = bucket.adjustmentHistory || [];
    bucket.adjustmentHistory.push({
      previousBalance,
      newBalance,
      change: newBalance - previousBalance,
      reason: reason.trim(),
      adjustedBy,
      adjustedAt: new Date()
    });

    await bucket.save();

    return {
      bucket,
      previousBalance,
      newBalance,
      change: newBalance - previousBalance
    };
  }

  calculateDays(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }

  async sendFinancialYearReport() {
    const istDate = this.getISTDate();
    const currentMonth = istDate.getMonth();
    const day = istDate.getDate();

    if (currentMonth !== 3 || day !== 1) {
      return { success: false, message: 'Not April 1st' };
    }

    const financialYear = this.getFinancialYear(istDate);
    const previousYear = financialYear.startYear - 1;

    console.log(`📊 Generating financial year report for ${previousYear}-${financialYear.startYear}`);

    const employees = await User.find({
      isActive: true,
      role: { $nin: ['Admin', 'HR', 'Client', 'Super Admin'] }
    }).select('_id name email role isProbationary');

    const reportData = [];

    for (const employee of employees) {
      const bucket = await this.getOrCreateBucket(employee._id);

      const yearlyRecord = bucket.yearlyUsage.find(
        y => y.year === previousYear
      );

      reportData.push({
        name: employee.name,
        email: employee.email,
        role: employee.role,
        isProbationary: employee.isProbationary || false,
        leavesTaken: yearlyRecord ? yearlyRecord.leavesTaken : 0,
        leavesAccrued: yearlyRecord ? yearlyRecord.leavesAccrued : 18,
        leavesNotTaken: yearlyRecord ? (yearlyRecord.leavesAccrued - yearlyRecord.leavesTaken) : 18,
        monthlyBreakdown: bucket.monthlyUsage.filter(m => m.year === previousYear)
      });
    }

    reportData.sort((a, b) => b.leavesTaken - a.leavesTaken);

    const html = this.generateFinancialYearReportHTML(reportData, previousYear);

    const recipients = [
      'hr.dataseeders@gmail.com',
      'dhaval@techdataseeders.in',
      'dakshesh@techdataseeders.in'
    ];
    for (const recipient of recipients) {
      try {
        await sendEmail({
          to: recipient,
          subject: `📊 Financial Year ${previousYear}-${financialYear.startYear} Leave Report`,
          html: html
        });
        console.log(`📧 Financial year report sent to ${recipient}`);
      } catch (error) {
        console.error(`❌ Failed to send report to ${recipient}:`, error.message);
      }
    }

    return {
      success: true,
      reportData,
      recipients,
      year: `${previousYear}-${financialYear.startYear}`
    };
  }

  generateFinancialYearReportHTML(reportData, year) {
    const totalEmployees = reportData.length;
    const totalLeavesTaken = reportData.reduce((sum, r) => sum + r.leavesTaken, 0);
    const totalLeavesNotTaken = reportData.reduce((sum, r) => sum + r.leavesNotTaken, 0);
    const avgLeavesTaken = (totalLeavesTaken / totalEmployees).toFixed(1);

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
        <table width="700" cellpadding="0" cellspacing="0" border="0" style="max-width:700px; width:100%; background:#ffffff; border-radius:24px; box-shadow:0 4px 12px rgba(0,0,0,0.05); overflow:hidden;">
          <tr>
            <td style="padding:32px 36px; border-bottom:1px solid #e2e8f0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right:12px; width:38px; vertical-align: middle;">
                    <img src="https://res.cloudinary.com/dhcwcyqke/image/upload/q_auto/f_auto/v1777631279/login_img_oycuic.png" alt="KUIPER" style="width:38px; height:38px; border-radius:10px; display:block;">
                  </td>
                  <td style="vertical-align: middle;">
                    <div style="font-size:20px; font-weight:800; color:#2563eb;">KUIPER</div>
                    <div style="font-size:8px; font-weight:600; color:#94a3b8; letter-spacing:0.25em; text-transform:uppercase; margin-top:3px;">Leave Management Report</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#1e293b; padding:28px 36px;">
              <div style="font-size:22px; font-weight:800; color:white; margin-bottom:4px;">📊 Financial Year Report</div>
              <div style="font-size:13px; color:#94a3b8; font-weight:500;">${year} • Annual Leave Summary</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                <tr>
                  <td width="25%" style="padding:12px; background:#f8fafc; border-radius:12px; text-align:center;">
                    <div style="font-size:24px; font-weight:800; color:#1e293b;">${totalEmployees}</div>
                    <div style="font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em;">Employees</div>
                  </td>
                  <td width="25%" style="padding:12px; background:#f8fafc; border-radius:12px; text-align:center;">
                    <div style="font-size:24px; font-weight:800; color:#2563eb;">${totalLeavesTaken}</div>
                    <div style="font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em;">Leaves Taken</div>
                  </td>
                  <td width="25%" style="padding:12px; background:#f8fafc; border-radius:12px; text-align:center;">
                    <div style="font-size:24px; font-weight:800; color:#10b981;">${totalLeavesNotTaken}</div>
                    <div style="font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em;">Leaves Unused</div>
                  </td>
                  <td width="25%" style="padding:12px; background:#f8fafc; border-radius:12px; text-align:center;">
                    <div style="font-size:24px; font-weight:800; color:#f59e0b;">${avgLeavesTaken}</div>
                    <div style="font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em;">Avg per Employee</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 36px 32px 36px;">
              <div style="font-size:14px; font-weight:700; color:#0f172a; margin-bottom:16px;">Detailed Employee Breakdown</div>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse: collapse; font-size:13px;">
                <thead>
                  <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0;">
                    <th style="padding:12px 8px; text-align:left; font-weight:700; color:#475569; text-transform:uppercase; font-size:9px; letter-spacing:0.05em;">Employee</th>
                    <th style="padding:12px 8px; text-align:left; font-weight:700; color:#475569; text-transform:uppercase; font-size:9px; letter-spacing:0.05em;">Role</th>
                    <th style="padding:12px 8px; text-align:center; font-weight:700; color:#475569; text-transform:uppercase; font-size:9px; letter-spacing:0.05em;">Status</th>
                    <th style="padding:12px 8px; text-align:center; font-weight:700; color:#475569; text-transform:uppercase; font-size:9px; letter-spacing:0.05em;">Leaves Taken</th>
                    <th style="padding:12px 8px; text-align:center; font-weight:700; color:#475569; text-transform:uppercase; font-size:9px; letter-spacing:0.05em;">Leaves Accrued</th>
                    <th style="padding:12px 8px; text-align:center; font-weight:700; color:#475569; text-transform:uppercase; font-size:9px; letter-spacing:0.05em;">Unused</th>
                  </tr>
                </thead>
                <tbody>
                  ${reportData.map((r, index) => `
                    <tr style="border-bottom:1px solid #f1f5f9;">
                      <td style="padding:10px 8px; font-weight:600; color:#1e293b;">${r.name}</td>
                      <td style="padding:10px 8px; color:#64748b; font-size:12px;">${r.role}</td>
                      <td style="padding:10px 8px; text-align:center;">
                        ${r.isProbationary
                          ? '<span style="background:#fef3c7; color:#d97706; padding:2px 8px; border-radius:10px; font-size:8px; font-weight:700;">Probation</span>'
                          : '<span style="background:#d1fae5; color:#065f46; padding:2px 8px; border-radius:10px; font-size:8px; font-weight:700;">Permanent</span>'
                        }
                      </td>
                      <td style="padding:10px 8px; text-align:center; font-weight:700; color:#dc2626;">${r.leavesTaken}</td>
                      <td style="padding:10px 8px; text-align:center; font-weight:700; color:#2563eb;">${r.leavesAccrued}</td>
                      <td style="padding:10px 8px; text-align:center; font-weight:700; color:#10b981;">${r.leavesNotTaken}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc; padding:24px 36px; text-align:center; border-radius:0 0 24px 24px;">
              <div style="font-size:10px; color:#94a3b8;">KUIPER HRMS • Automated Year End Leave Report</div>
              <div style="font-size:8px; color:#cbd5e1; margin-top:4px;">Generated on ${new Date().toLocaleDateString()}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  async resetFinancialYear() {
    const istDate = this.getISTDate();
    const currentMonth = istDate.getMonth();
    const day = istDate.getDate();

    if (currentMonth !== 3 || day !== 1) {
      return { success: false, message: 'Not April 1st' };
    }

    console.log(`🔄 Resetting leave buckets for new financial year`);

    const result = await LeaveBucket.updateMany(
      {},
      {
        $set: {
          leavesTakenThisYear: 0,
          totalBalance: 0,
          financialYearStart: new Date(istDate.getFullYear(), 3, 1),
          financialYearEnd: new Date(istDate.getFullYear() + 1, 2, 31)
        }
      }
    );

    console.log(`✅ Reset ${result.modifiedCount} leave buckets`);

    return {
      success: true,
      modifiedCount: result.modifiedCount
    };
  }
}

module.exports = new LeaveBucketService();