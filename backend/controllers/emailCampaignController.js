const XLSX =
  require('xlsx');

const EmailCampaign =
  require('../models/EmailCampaign');

exports.uploadCampaign =
  async (req, res) => {

    try {

      if (!req.file) {

        return res.status(400).json({
          error: 'Excel file missing'
        });

      }

      const workbook =
        XLSX.readFile(req.file.path);

      const sheetName =
        workbook.SheetNames[0];

      const data =
        XLSX.utils.sheet_to_json(
          workbook.Sheets[sheetName]
        );

      const {
        templateId
      } = req.body;

      const campaigns = [];

      for (const row of data) {

        const campaign =
          new EmailCampaign({

            name:
              row.Name,

            email:
              row.Email,

            templateId,

            currentStep: 0,

            startDate:
              new Date(),

            nextSendDate:
              new Date(),

            status:
              'Pending'

          });

        campaigns.push(campaign);

      }

      await EmailCampaign.insertMany(
        campaigns
      );

      res.json({
        success: true,
        count: campaigns.length
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error:
          'Failed to upload campaign'
      });

    }

  };