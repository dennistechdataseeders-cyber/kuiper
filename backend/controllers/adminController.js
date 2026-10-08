const User = require('../models/User');
const Log = require('../models/Log');
const LeaveBucket = require('../models/LeaveBucket');
const LeaveApplication = require('../models/LeaveApplication');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const leaveBucketService = require('../services/leaveBucketService');

// ============================================
// MAIL TRANSPORTER (Gmail — for welcome emails)
// ============================================
const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: { rejectUnauthorized: false }
});

// ============================================
// ✅ PERMISSION HELPERS
// ============================================

// Who is allowed to hit these endpoints at all?
const ADMIN_LEVEL_ROLES = ['Super Admin', 'Admin', 'HR'];

// Roles that HR is forbidden from creating or editing TO
const FORBIDDEN_ROLES_FOR_HR = ['Admin', 'Super Admin'];

// Roles HR is forbidden from editing/deleting
const PROTECTED_TARGET_ROLES_FOR_HR = ['Admin', 'Super Admin', 'HR'];

/**
 * Assert the caller is an Admin-level user.
 * Returns { ok, error }.
 */
function checkAdminLevel(req) {
  if (!req.user || !ADMIN_LEVEL_ROLES.includes(req.user.role)) {
    return { ok: false, error: 'Forbidden: admin access required' };
  }
  return { ok: true };
}

/**
 * Assert the requested role can be assigned by the caller.
 * HR cannot create/assign Admin or Super Admin.
 */
function canAssignRole(caller, targetRole) {
  if (caller.role === 'HR' && FORBIDDEN_ROLES_FOR_HR.includes(targetRole)) {
    return false;
  }
  return true;
}

/**
 * Assert the caller can modify the given target user.
 * - HR cannot modify Admin / Super Admin / other HR
 * - Admin cannot modify Super Admin
 * - Super Admin can modify anyone except self-deletion (checked separately)
 */
function canModifyTarget(caller, targetUser) {
  if (!targetUser) return false;

  if (caller.role === 'Super Admin') return true;

  if (caller.role === 'Admin') {
    return targetUser.role !== 'Super Admin';
  }

  if (caller.role === 'HR') {
    return !PROTECTED_TARGET_ROLES_FOR_HR.includes(targetUser.role);
  }

  return false;
}

// ============================================
// ✅ GET: List all users (Admin/HR)
// ============================================
exports.getUsers = async (req, res) => {
  try {
    const perm = checkAdminLevel(req);
    if (!perm.ok) return res.status(403).json({ error: perm.error });

    const users = await User.find({})
      .select('-password -resetPasswordToken -resetPasswordExpires')
      .populate('organizationId', 'companyName website')
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (error) {
    console.error('getUsers error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// ============================================
// ✅ GET: Developers only
// ============================================
exports.getDevelopers = async (req, res) => {
  try {
    const perm = checkAdminLevel(req);
    if (!perm.ok) return res.status(403).json({ error: perm.error });

    const developers = await User.find({ role: 'Developer', isActive: true })
      .select('_id name email githubUsername githubLinked employeeCode role')
      .sort({ name: 1 });

    res.json(developers);
  } catch (error) {
    console.error('getDevelopers error:', error);
    res.status(500).json({ error: 'Failed to fetch developers' });
  }
};

// ============================================
// ✅ GET: Project Managers only
// ============================================
exports.getProjectManagers = async (req, res) => {
  try {
    const perm = checkAdminLevel(req);
    if (!perm.ok) return res.status(403).json({ error: perm.error });

    const pms = await User.find({ role: 'Project Manager', isActive: true })
      .select('_id name email role')
      .sort({ name: 1 });

    res.json(pms);
  } catch (error) {
    console.error('getProjectManagers error:', error);
    res.status(500).json({ error: 'Failed to fetch project managers' });
  }
};

// ============================================
// ✅ GET: Team Leads only
// ============================================
exports.getTeamLeads = async (req, res) => {
  try {
    const perm = checkAdminLevel(req);
    if (!perm.ok) return res.status(403).json({ error: perm.error });

    const teamLeads = await User.find({ role: 'Team Lead', isActive: true })
      .select('_id name email role')
      .sort({ name: 1 });

    res.json(teamLeads);
  } catch (error) {
    console.error('getTeamLeads error:', error);
    res.status(500).json({ error: 'Failed to fetch team leads' });
  }
};

// ============================================
// ✅ POST: Create user
// ============================================
exports.createUser = async (req, res) => {
  try {
    const perm = checkAdminLevel(req);
    if (!perm.ok) return res.status(403).json({ error: perm.error });

    const {
      name,
      email,
      password,
      role,
      githubUsername,
      dateOfJoining,
      dateOfBirth,
      contactNumber,
      emergencyContact,
      address,
      employeeCode,
      designation,
      department,
      organizationId,
      isPrimaryPOC,
      shiftHour,
      shiftMinute,
      shiftAmPm,
    } = req.body;

    // ---- Basic validation ----
    if (!name || !email || !role) {
      return res.status(400).json({ error: 'Name, email, and role are required' });
    }
    if (!password || password === 'undefined' || password === '') {
      return res.status(400).json({ error: 'Password is required' });
    }

    // ✅ Role whitelist per caller (HR cannot create Admin / Super Admin)
    if (!canAssignRole(req.user, role)) {
      return res.status(403).json({
        error: `Your role (${req.user.role}) is not permitted to create a ${role} account`,
      });
    }

    // ---- Duplicate email check ----
    const existingByEmail = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingByEmail) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // ---- Duplicate employee code check (if provided) ----
    const normalizedCode = employeeCode ? String(employeeCode).trim().toUpperCase() : null;
    if (normalizedCode) {
      const existingByCode = await User.findOne({ employeeCode: normalizedCode });
      if (existingByCode) {
        return res.status(400).json({
          error: `Employee code "${normalizedCode}" is already assigned to ${existingByCode.name}`,
        });
      }
    }

    // ---- Hash password ----
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(String(password), salt);

    // ============================================
    // ✅ AUTO-SET PROBATION
    //   Not for Admin, Super Admin, HR, Client
    // ============================================
    let isProbationary = false;
    let probationEndDate = null;

    const shouldHaveProbation = !['Admin', 'Super Admin', 'HR', 'Client'].includes(role);
    if (shouldHaveProbation) {
      isProbationary = true;
      const startDate = dateOfJoining ? new Date(dateOfJoining) : new Date();
      probationEndDate = new Date(startDate);
      probationEndDate.setMonth(probationEndDate.getMonth() + 3);
      console.log(
        `📋 Probation set for ${name}: until ${probationEndDate.toISOString().split('T')[0]}`
      );
    }

    // ============================================
    // ✅ Build user document with ALL fields
    // ============================================
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: role.trim(),
      githubUsername: githubUsername || '',
      githubLinked: !!githubUsername,
      isProbationary,
      probationEndDate,
      dateOfJoining: dateOfJoining || null,
      dateOfBirth: dateOfBirth || null,
      contactNumber: contactNumber || '',
      emergencyContact: emergencyContact || '',
      address: address || '',
      employeeCode: normalizedCode,
      designation: designation || '',
      department: department || 'Other',
      organizationId: organizationId || null,
      isPrimaryPOC: !!isPrimaryPOC,
      shiftHour: typeof shiftHour === 'number' ? shiftHour : parseInt(shiftHour) || 9,
      shiftMinute: typeof shiftMinute === 'number' ? shiftMinute : parseInt(shiftMinute) || 0,
      shiftAmPm: shiftAmPm || 'AM',
      isActive: true,
    });

    await user.save();
    console.log('✅ User saved to DB:', user.email);

    // ---- Audit log ----
    try {
      await Log.create({
        actionType: 'USER_CREATED',
        performerId: req.user._id,
        details: `${req.user.role} ${req.user.name} created ${role} account: ${name} (${email})`,
        timestamp: new Date(),
      });
    } catch (logErr) {
      console.error('Audit log failed (non-critical):', logErr.message);
    }

    // ---- Respond immediately ----
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      employeeCode: user.employeeCode,
      githubUsername: user.githubUsername,
      githubLinked: user.githubLinked,
      isProbationary: user.isProbationary,
      probationEndDate: user.probationEndDate,
      probation: isProbationary
        ? {
            isProbationary: true,
            endDate: probationEndDate,
            durationMonths: 3,
            daysRemaining: Math.ceil((probationEndDate - new Date()) / (1000 * 60 * 60 * 24)),
          }
        : null,
      message: 'User created. Sending welcome email in background...',
    });

    // ============================================
    // ✅ BACKGROUND EMAIL
    // ============================================
    (async () => {
      try {
        console.log('📧 Sending welcome email to:', email);
        await transporter.verify();

        let probationNote = '';
        if (isProbationary && probationEndDate) {
          probationNote = `
            <div style="background:#fef3c7; padding:12px 16px; border-radius:8px; margin:12px 0; border-left:4px solid #f59e0b;">
              <p style="margin:0; font-size:13px; color:#92400e;">
                <strong>📋 Probation Period:</strong> You are on probation for 3 months until
                <strong>${probationEndDate.toLocaleDateString()}</strong>.
                During this time, you can only apply for <strong>Unpaid Leave</strong>.
              </p>
            </div>
          `;
        }

        const mailOptions = {
          from: `"KUIPER" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: '🚀 Your System Access Credentials',
          html: `
            <h1>Welcome ${name}</h1>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Password:</strong> ${password}</p>
            <p><strong>Role:</strong> ${role}</p>
            ${probationNote}
            <p style="font-size:12px; color:#64748b; margin-top:16px;">
              Please change your password after your first login.
            </p>
          `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Welcome email sent:', info.messageId);
      } catch (mailError) {
        console.error('❌ MAIL SYSTEM ERROR:', mailError.message);
        console.error('DEBUG INFO:', {
          user: process.env.EMAIL_USER,
          passLength: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0,
        });
      }
    })();
  } catch (error) {
    console.error('❌ createUser CONTROLLER ERROR:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
};

// ============================================
// ✅ PUT: Update user
// ============================================
exports.updateUser = async (req, res) => {
  try {
    const perm = checkAdminLevel(req);
    if (!perm.ok) return res.status(403).json({ error: perm.error });

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });

    // ✅ Target-level guard
    if (!canModifyTarget(req.user, target)) {
      return res.status(403).json({
        error: `Your role (${req.user.role}) is not permitted to modify a ${target.role} account`,
      });
    }

    const {
      name,
      email,
      password,
      role,
      githubUsername,
      dateOfJoining,
      dateOfBirth,
      contactNumber,
      emergencyContact,
      address,
      employeeCode,
      designation,
      department,
      organizationId,
      isPrimaryPOC,
      shiftHour,
      shiftMinute,
      shiftAmPm,
      isActive,
    } = req.body;

    // ✅ Prevent HR from promoting anyone to Admin / Super Admin
    if (role && role !== target.role && !canAssignRole(req.user, role)) {
      return res.status(403).json({
        error: `Your role (${req.user.role}) is not permitted to assign the ${role} role`,
      });
    }

    // ✅ Prevent changing a user's role TO something that would place them out of reach
    //   e.g. HR cannot change a Developer → Admin
    if (role && FORBIDDEN_ROLES_FOR_HR.includes(role) && req.user.role === 'HR') {
      return res.status(403).json({
        error: 'HR cannot assign Admin or Super Admin roles',
      });
    }

    // Duplicate email check (if email changed)
    if (email && email.toLowerCase().trim() !== target.email) {
      const dup = await User.findOne({
        email: email.toLowerCase().trim(),
        _id: { $ne: target._id },
      });
      if (dup) return res.status(400).json({ error: 'Email already in use' });
      target.email = email.toLowerCase().trim();
    }

    // Duplicate employeeCode check (if provided and changed)
    if (employeeCode !== undefined) {
      const normalizedCode = employeeCode ? String(employeeCode).trim().toUpperCase() : null;
      if (normalizedCode && normalizedCode !== target.employeeCode) {
        const dupCode = await User.findOne({
          employeeCode: normalizedCode,
          _id: { $ne: target._id },
        });
        if (dupCode) {
          return res.status(400).json({
            error: `Employee code "${normalizedCode}" is already assigned to ${dupCode.name}`,
          });
        }
      }
      target.employeeCode = normalizedCode;
    }

    // Optional fields
    if (name !== undefined) target.name = name.trim();
    if (role !== undefined) target.role = role.trim();
    if (githubUsername !== undefined) {
      target.githubUsername = githubUsername || '';
      target.githubLinked = !!githubUsername;
    }
    if (dateOfJoining !== undefined) target.dateOfJoining = dateOfJoining || null;
    if (dateOfBirth !== undefined) target.dateOfBirth = dateOfBirth || null;
    if (contactNumber !== undefined) target.contactNumber = contactNumber || '';
    if (emergencyContact !== undefined) target.emergencyContact = emergencyContact || '';
    if (address !== undefined) target.address = address || '';
    if (designation !== undefined) target.designation = designation || '';
    if (department !== undefined) target.department = department || 'Other';
    if (organizationId !== undefined) target.organizationId = organizationId || null;
    if (isPrimaryPOC !== undefined) target.isPrimaryPOC = !!isPrimaryPOC;
    if (shiftHour !== undefined) target.shiftHour = parseInt(shiftHour) || 9;
    if (shiftMinute !== undefined) target.shiftMinute = parseInt(shiftMinute) || 0;
    if (shiftAmPm !== undefined) target.shiftAmPm = shiftAmPm || 'AM';
    if (isActive !== undefined) target.isActive = !!isActive;

    // Password change (optional)
    if (password && password.trim() !== '' && password !== 'undefined') {
      const salt = await bcrypt.genSalt(10);
      target.password = await bcrypt.hash(String(password), salt);
    }

    await target.save();
    console.log('✅ User updated:', target.email);

    // Audit log
    try {
      await Log.create({
        actionType: 'USER_UPDATED',
        performerId: req.user._id,
        details: `${req.user.role} ${req.user.name} updated user ${target.email} (${target.role})`,
        timestamp: new Date(),
      });
    } catch (logErr) {
      console.error('Audit log failed (non-critical):', logErr.message);
    }

    const sanitized = target.toObject();
    delete sanitized.password;
    delete sanitized.resetPasswordToken;
    delete sanitized.resetPasswordExpires;

    res.json(sanitized);
  } catch (error) {
    console.error('❌ updateUser error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================
// ✅ DELETE: Remove user
// ============================================
exports.deleteUser = async (req, res) => {
  try {
    const perm = checkAdminLevel(req);
    if (!perm.ok) return res.status(403).json({ error: perm.error });

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });

    // Self-deletion guard
    if (String(target._id) === String(req.user._id)) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    // Target-level guard
    if (!canModifyTarget(req.user, target)) {
      return res.status(403).json({
        error: `Your role (${req.user.role}) is not permitted to delete a ${target.role} account`,
      });
    }

    const snapshot = {
      name: target.name,
      email: target.email,
      role: target.role,
    };

    await User.findByIdAndDelete(target._id);

    try {
      await Log.create({
        actionType: 'USER_DELETED',
        performerId: req.user._id,
        details: `${req.user.role} ${req.user.name} deleted ${snapshot.role} account: ${snapshot.name} (${snapshot.email})`,
        timestamp: new Date(),
      });
    } catch (logErr) {
      console.error('Audit log failed (non-critical):', logErr.message);
    }

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('❌ deleteUser error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================
// ✅ POST: Link GitHub account
// ============================================
exports.linkGitHub = async (req, res) => {
  try {
    const perm = checkAdminLevel(req);
    if (!perm.ok) return res.status(403).json({ error: perm.error });

    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.role !== 'Developer') {
      return res.status(400).json({ error: 'GitHub linking is only available for Developer accounts' });
    }

    // Target-level guard
    if (!canModifyTarget(req.user, user)) {
      return res.status(403).json({
        error: `Your role (${req.user.role}) is not permitted to modify this account`,
      });
    }

    const gitService = require('../services/gitService');
    const result = await gitService.linkGitHubAccountToUser(userId, user.email);

    if (result.success && result.githubUsername) {
      user.githubUsername = result.githubUsername;
      user.githubLinked = true;
      await user.save();

      return res.json({
        success: true,
        message: `GitHub account ${result.githubUsername} linked successfully`,
        githubUsername: result.githubUsername,
        githubLinked: true,
        profile_url: result.profile_url,
      });
    }

    return res.status(404).json({
      success: false,
      error: result.message || 'No GitHub account found with this email address',
      githubLinked: false,
    });
  } catch (error) {
    console.error('❌ linkGitHub error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================
// ✅ GET: Leave history for a user
//   Returns balances + aggregated adjustment history
// ============================================
exports.getUserLeaveHistory = async (req, res) => {
  try {
    const perm = checkAdminLevel(req);
    if (!perm.ok) return res.status(403).json({ error: perm.error });

    const { userId } = req.params;

    const user = await User.findById(userId).select('_id name email role');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const bucket = await LeaveBucket.findOne({ employeeId: userId });

    const balances = {
      'Paid Leave': bucket ? bucket.totalBalance : 0,
      'Unpaid Leave': '∞',
    };

    // Build a history array from the bucket's adjustmentHistory (most reliable source)
    const adjustments = (bucket?.adjustmentHistory || []).map((entry) => ({
      type: entry.change < 0 ? 'deducted' : entry.change > 0 ? 'added' : 'set',
      leaveType: 'Paid Leave',
      amount: entry.change,
      previousBalance: entry.previousBalance,
      newBalance: entry.newBalance,
      reason: entry.reason,
      date: entry.adjustedAt || entry.createdAt || new Date(),
    }));

    // Additionally, show recent LeaveApplication approvals
    const leaves = await LeaveApplication.find({
      employeeId: userId,
      status: 'approved',
    })
      .select('leaveType startDate endDate isHalfDay approvedAt')
      .sort({ approvedAt: -1 })
      .limit(20);

    const approvals = leaves.map((l) => {
      const days = l.isHalfDay
        ? 0.5
        : Math.ceil((new Date(l.endDate) - new Date(l.startDate)) / (1000 * 60 * 60 * 24)) + 1;
      return {
        type: l.leaveType === 'Paid Leave' ? 'deducted' : 'approved',
        leaveType: l.leaveType,
        amount: l.leaveType === 'Paid Leave' ? -days : days,
        reason: `Leave approved (${new Date(l.startDate).toLocaleDateString()} → ${new Date(l.endDate).toLocaleDateString()})`,
        date: l.approvedAt || new Date(),
      };
    });

    // Merge + sort, newest first
    const history = [...adjustments, ...approvals].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        balances,
        history,
      },
    });
  } catch (error) {
    console.error('❌ getUserLeaveHistory error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================
// ✅ PATCH: Adjust a user's leave balance
//   Body: { leaveType?, action?: 'add'|'deduct'|'set', amount?, newBalance?, reason }
//   The frontend currently sends: { leaveType, amount, action, reason }
//   We translate that into newBalance and call leaveBucketService.adjustBalance,
//   which ALSO sends the employee notification email.
// ============================================
exports.adjustUserLeaveBalance = async (req, res) => {
  try {
    const perm = checkAdminLevel(req);
    if (!perm.ok) return res.status(403).json({ error: perm.error });

    const { userId } = req.params;
    const { leaveType = 'Paid Leave', amount, action, newBalance, reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Reason is required for a balance adjustment' });
    }

    const user = await User.findById(userId).select('_id name email role');
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Only Paid Leave is tracked in the bucket system
    if (leaveType !== 'Paid Leave') {
      return res.status(400).json({
        error: `Only "Paid Leave" can be adjusted via this endpoint. Received: ${leaveType}`,
      });
    }

    // Ensure the bucket exists
    const bucket = await leaveBucketService.getOrCreateBucket(userId);
    const previousBalance = bucket.totalBalance;

    // Compute target newBalance
    let targetBalance;
    if (newBalance !== undefined && newBalance !== null && !isNaN(newBalance)) {
      targetBalance = parseFloat(newBalance);
    } else {
      if (amount === undefined || amount === null || isNaN(amount)) {
        return res.status(400).json({ error: 'amount (or newBalance) is required' });
      }
      const amt = parseFloat(amount);
      switch (action) {
        case 'add':
          targetBalance = previousBalance + amt;
          break;
        case 'deduct':
          targetBalance = previousBalance - amt;
          break;
        case 'set':
          targetBalance = amt;
          break;
        default:
          return res.status(400).json({ error: 'action must be one of: add, deduct, set' });
      }
    }

    if (targetBalance < 0) {
      return res.status(400).json({ error: 'Leave balance cannot be negative' });
    }

    // ✅ adjustBalance sends the employee notification email (from the earlier change)
    const result = await leaveBucketService.adjustBalance(
      userId,
      targetBalance,
      reason.trim(),
      req.user._id
    );

    // Fetch refreshed balances so the frontend modal updates
    const refreshedBucket = await LeaveBucket.findOne({ employeeId: userId });

    try {
      await Log.create({
        actionType: 'LEAVE_BALANCE_ADJUSTED',
        performerId: req.user._id,
        details:
          `${req.user.role} ${req.user.name} set Paid Leave balance for ${user.name} ` +
          `from ${previousBalance} to ${targetBalance} (${result.change >= 0 ? '+' : ''}${result.change}). Reason: ${reason.trim()}`,
        timestamp: new Date(),
      });
    } catch (logErr) {
      console.error('Audit log failed (non-critical):', logErr.message);
    }

    res.json({
      success: true,
      data: {
        allBalances: {
          'Paid Leave': refreshedBucket ? refreshedBucket.totalBalance : targetBalance,
          'Unpaid Leave': '∞',
        },
        previousBalance: result.previousBalance,
        newBalance: result.newBalance,
        change: result.change,
      },
      message: 'Leave balance updated and employee notified by email',
    });
  } catch (error) {
    console.error('❌ adjustUserLeaveBalance error:', error);
    res.status(400).json({ error: error.message });
  }
};

// ============================================
// ✅ GET: Analytics (unchanged behaviour)
// ============================================
exports.getAnalytics = async (req, res) => {
  try {
    const { limit, page } = req.query;

    if (limit) {
      const parsedLimit = parseInt(limit) || 5;
      const parsedPage = parseInt(page) || 1;
      const skip = (parsedPage - 1) * parsedLimit;

      const [logs, totalLogs] = await Promise.all([
        Log.find()
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(parsedLimit)
          .populate('performerId', 'name role'),
        Log.countDocuments(),
      ]);

      const totalPages = Math.ceil(totalLogs / parsedLimit);

      return res.json({
        logs,
        totalLogs,
        totalPages,
        currentPage: parsedPage,
      });
    }

    const logs = await Log.find()
      .sort({ timestamp: -1 })
      .populate('performerId', 'name role');

    res.json(logs);
  } catch (error) {
    console.error('getAnalytics error:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
};