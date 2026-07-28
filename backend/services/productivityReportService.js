// backend/services/productivityReportService.js

const User = require('../models/User');
const Ticket = require('../models/Ticket');
const LeadGen = require('../models/LeadGen');
const Prospect = require('../models/Prospect');
const Project = require('../models/Project');
const Feed = require('../models/Feed');

class ProductivityReportService {
  
  // ============================================
  // GET DEVELOPER DATA
  // ============================================
  async getDeveloperData() {
    try {
      const developers = await User.find({ role: 'Developer' }).select('name email _id');
      
      const developerData = await Promise.all(developers.map(async (dev) => {
        // Get open tickets assigned to this developer (not closed)
        const openTickets = await Ticket.find({
          assignedTo: dev._id,
          status: { $in: ['Open', 'In Progress'] }
        }).select('title ticketNumber priority status createdAt');
        
        // Get feasibility tickets assigned to this developer
        const feasibilityTickets = await Ticket.find({
          assignedTo: dev._id,
          category: 'Production',
          subcategory: 'Feasibility',
          status: { $in: ['Open', 'In Progress'] }
        }).select('title ticketNumber priority status createdAt');
        
        return {
          name: dev.name,
          email: dev.email,
          openTickets: openTickets,
          openTicketsCount: openTickets.length,
          feasibilityTickets: feasibilityTickets,
          feasibilityTicketsCount: feasibilityTickets.length
        };
      }));
      
      return developerData;
    } catch (error) {
      console.error('Error fetching developer data:', error);
      return [];
    }
  }

  // ============================================
  // GET SALES PERSON DATA
  // ============================================
  async getSalesPersonData() {
    try {
      const salesPeople = await User.find({ 
        role: { $in: ['Sales', 'Sales Representative'] } 
      }).select('name email _id');
      
      const salesData = await Promise.all(salesPeople.map(async (sales) => {
        // Get total follow-ups (leads with follow-up scheduled)
        const totalFollowUps = await LeadGen.countDocuments({
          salesRepId: sales._id,
          status: 'Follow-up Scheduled'
        });
        
        // Get pending feasibility (leads in feasibility status)
        const pendingFeasibility = await LeadGen.countDocuments({
          salesRepId: sales._id,
          status: 'Feasibility'
        });
        
        return {
          name: sales.name,
          email: sales.email,
          totalFollowUps: totalFollowUps,
          pendingFeasibility: pendingFeasibility
        };
      }));
      
      return salesData;
    } catch (error) {
      console.error('Error fetching sales data:', error);
      return [];
    }
  }

  // ============================================
  // GET PROJECT MANAGER DATA
  // ============================================
  async getPMData() {
    try {
      const pms = await User.find({ role: 'Project Manager' }).select('name email _id');
      
      const pmData = await Promise.all(pms.map(async (pm) => {
        // Get projects managed by this PM
        const projects = await Project.find({ 
          projectManager: pm._id 
        }).select('_id projectCustomId name');
        
        const projectIds = projects.map(p => p._id);
        
        // Get unresolved tickets for these projects
        const unresolvedTickets = await Ticket.find({
          projectId: { $in: projectIds },
          status: { $in: ['Open', 'In Progress'] }
        })
        .populate('assignedTo', 'name')
        .populate('projectId', 'projectCustomId')
        .select('title ticketNumber assignedTo projectId priority status');
        
        // Group tickets by developer
        const ticketsByDeveloper = {};
        unresolvedTickets.forEach(ticket => {
          const devName = ticket.assignedTo?.name || 'Unassigned';
          if (!ticketsByDeveloper[devName]) {
            ticketsByDeveloper[devName] = [];
          }
          ticketsByDeveloper[devName].push({
            ticketNumber: ticket.ticketNumber,
            title: ticket.title,
            priority: ticket.priority,
            project: ticket.projectId?.projectCustomId || 'N/A'
          });
        });
        
        return {
          name: pm.name,
          email: pm.email,
          totalProjects: projects.length,
          unresolvedTicketsCount: unresolvedTickets.length,
          ticketsByDeveloper: ticketsByDeveloper,
          projects: projects
        };
      }));
      
      return pmData;
    } catch (error) {
      console.error('Error fetching PM data:', error);
      return [];
    }
  }

  // ============================================
  // GET SALES MANAGER DATA
  // ============================================
  async getSalesManagerData() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const salesPeople = await User.find({ 
        role: { $in: ['Sales', 'Sales Representative'] } 
      }).select('name email _id');
      
      // Get all sales managers
      const salesManagers = await User.find({ role: 'Sales Manager' }).select('name email _id');
      
      const salesManagerData = await Promise.all(salesManagers.map(async (manager) => {
        // Get follow-ups taken today for each sales person
        const followUpsToday = await Promise.all(salesPeople.map(async (sales) => {
          // Count follow-ups created today
          const todayFollowUps = await LeadGen.countDocuments({
            salesRepId: sales._id,
            status: 'Follow-up Scheduled',
            lastActionDate: { $gte: today }
          });
          
          return {
            name: sales.name,
            email: sales.email,
            followUpsToday: todayFollowUps
          };
        }));
        
        // Calculate total follow-ups today
        const totalFollowUpsToday = followUpsToday.reduce((sum, s) => sum + s.followUpsToday, 0);
        
        return {
          name: manager.name,
          email: manager.email,
          totalFollowUpsToday: totalFollowUpsToday,
          employeeBreakdown: followUpsToday
        };
      }));
      
      return salesManagerData;
    } catch (error) {
      console.error('Error fetching sales manager data:', error);
      return [];
    }
  }

  // ============================================
  // GET HR DATA (Bonus: Overall stats for HR)
  // ============================================
  async getHRData() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const totalEmployees = await User.countDocuments({ 
        isActive: true,
        role: { $nin: ['Admin', 'HR'] }
      });
      
      const todayPunches = await EmployeePunchLog.countDocuments({
        date: { $gte: today }
      });
      
      const todayPunchUsers = await EmployeePunchLog.distinct('employeeId', {
        date: { $gte: today }
      });
      
      const pendingLeaves = await LeaveApplication.countDocuments({ status: 'pending' });
      
      const openTickets = await Ticket.countDocuments({
        status: { $in: ['Open', 'In Progress'] }
      });
      
      return [{
        name: 'HR Team',
        totalEmployees: totalEmployees,
        todayPunches: todayPunches.length || 0,
        todayPresent: todayPunchUsers.length || 0,
        pendingLeaves: pendingLeaves,
        openTickets: openTickets,
        attendanceRate: totalEmployees > 0 
          ? Math.round((todayPunchUsers.length / totalEmployees) * 100) 
          : 0
      }];
    } catch (error) {
      console.error('Error fetching HR data:', error);
      return [];
    }
  }

  // ============================================
  // GET COMPLETE REPORT DATA
  // ============================================
  async getCompleteReport() {
    const [developers, salesPeople, projectManagers, salesManagers, hrData] = await Promise.all([
      this.getDeveloperData(),
      this.getSalesPersonData(),
      this.getPMData(),
      this.getSalesManagerData(),
      this.getHRData()
    ]);
    
    return {
      developers,
      salesPeople,
      projectManagers,
      salesManagers,
      hrData,
      generatedAt: new Date().toISOString()
    };
  }
}

module.exports = new ProductivityReportService();