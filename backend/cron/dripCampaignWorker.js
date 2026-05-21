const cron =
  require('node-cron');

const EmailCampaign =
  require('../models/EmailCampaign');

const sendEmail =
  require('../services/zohoMailer');

const emailTemplates =
  require('../templates/emailTemplates');

const delays = [
  0,
  2,
  5,
  12,
  22,
  37
];

const sleep = (ms) =>
  new Promise(resolve =>
    setTimeout(resolve, ms)
  );

cron.schedule(
  '0 9 * * *',
  async () => {

    console.log(
      'Running drip campaign worker'
    );

    try {

      const today =
        new Date();

      const campaigns =
        await EmailCampaign.find({

          completed: false,

          nextSendDate: {
            $lte: today
          }

        });

      for (const campaign of campaigns) {

        try {

          const step =
            campaign.currentStep;

          const template =
            emailTemplates[
              campaign.templateId
            ][step];

          const html =
            template.html.replace(
              /{{name}}/g,
              campaign.name
            );

          await sendEmail({

            to:
              campaign.email,

            subject:
              template.subject,

            html

          });

          /*
          ====================================
          NEXT STEP
          ====================================
          */

          campaign.currentStep += 1;

          if (
            campaign.currentStep >= 6
          ) {

            campaign.completed = true;

            campaign.status =
              'Completed';

          } else {

            const nextDelay =
              delays[
                campaign.currentStep
              ];

            const nextDate =
              new Date(
                campaign.startDate
              );

            nextDate.setDate(
              nextDate.getDate() +
              nextDelay
            );

            campaign.nextSendDate =
              nextDate;

            campaign.status =
              'Running';

          }

          await campaign.save();

          /*
          ====================================
          ZOHO RATE LIMIT
          ====================================
          */

          await sleep(5000);

        } catch (error) {

          console.error(error);

          campaign.status = 'Failed';

          await campaign.save();

        }

      }

    } catch (error) {

      console.error(error);

    }

  }
);