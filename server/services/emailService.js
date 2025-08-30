const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    // Configure email transporter (using Gmail as example)
    this.transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  async sendRegistrationConfirmation(user, tournament, registration, paymentInstructions) {
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@sportstournament.com.au',
      to: user.email,
      subject: `Registration Confirmation - ${tournament.name}`,
      html: this.generateRegistrationConfirmationHTML(user, tournament, registration, paymentInstructions)
    };

    try {
      if (process.env.NODE_ENV === 'production') {
        await this.transporter.sendMail(mailOptions);
        console.log(`Registration confirmation email sent to ${user.email}`);
      } else {
        console.log('Email would be sent in production:', mailOptions);
      }
    } catch (error) {
      console.error('Error sending registration confirmation email:', error);
    }
  }

  async sendPaymentVerificationEmail(user, tournament, registration, isApproved) {
    const subject = isApproved 
      ? `Payment Confirmed - ${tournament.name}` 
      : `Payment Issue - ${tournament.name}`;

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@sportstournament.com.au',
      to: user.email,
      subject: subject,
      html: this.generatePaymentVerificationHTML(user, tournament, registration, isApproved)
    };

    try {
      if (process.env.NODE_ENV === 'production') {
        await this.transporter.sendMail(mailOptions);
        console.log(`Payment verification email sent to ${user.email}`);
      } else {
        console.log('Email would be sent in production:', mailOptions);
      }
    } catch (error) {
      console.error('Error sending payment verification email:', error);
    }
  }

  async sendTournamentUpdateEmail(users, tournament, updateType, message) {
    const subject = `Tournament Update - ${tournament.name}`;

    for (const user of users) {
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@sportstournament.com.au',
        to: user.email,
        subject: subject,
        html: this.generateTournamentUpdateHTML(user, tournament, updateType, message)
      };

      try {
        if (process.env.NODE_ENV === 'production') {
          await this.transporter.sendMail(mailOptions);
        } else {
          console.log('Tournament update email would be sent in production:', mailOptions);
        }
      } catch (error) {
        console.error(`Error sending tournament update email to ${user.email}:`, error);
      }
    }
  }

  generateRegistrationConfirmationHTML(user, tournament, registration, paymentInstructions) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Registration Confirmation</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .payment-box { background: #e3f2fd; border: 2px solid #2196f3; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .bank-details { background: white; padding: 15px; border-radius: 5px; margin: 10px 0; }
          .reference-box { background: #fff3cd; border: 2px solid #ffc107; border-radius: 5px; padding: 15px; margin: 15px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; }
          .btn { display: inline-block; background: #2196f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏆 Registration Successful!</h1>
            <p>Welcome to ${tournament.name}</p>
          </div>
          
          <div class="content">
            <h2>G'day ${user.firstName}!</h2>
            
            <p>Your registration for <strong>${tournament.name}</strong> has been successfully submitted!</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Tournament Details:</h3>
              <ul>
                <li><strong>Sport:</strong> ${tournament.sport}</li>
                <li><strong>Date:</strong> ${new Date(tournament.startDate).toLocaleDateString('en-AU')}</li>
                <li><strong>Venue:</strong> ${tournament.venue}</li>
                <li><strong>Location:</strong> ${tournament.address.city}, ${tournament.address.state}</li>
                <li><strong>Registration Type:</strong> ${registration.type}</li>
                ${registration.teamName ? `<li><strong>Team Name:</strong> ${registration.teamName}</li>` : ''}
              </ul>
            </div>

            <div class="payment-box">
              <h3>💳 Payment Instructions</h3>
              <p><strong>Entry Fee: $${tournament.entryFee}</strong></p>
              
              <div class="bank-details">
                <h4>Bank Transfer Details:</h4>
                <p><strong>Account Name:</strong> ${paymentInstructions.bankDetails.accountName}</p>
                <p><strong>BSB:</strong> ${paymentInstructions.bankDetails.bsb}</p>
                <p><strong>Account Number:</strong> ${paymentInstructions.bankDetails.accountNumber}</p>
                <p><strong>Bank:</strong> ${paymentInstructions.bankDetails.bankName}</p>
              </div>

              <div class="reference-box">
                <h4>⚠️ IMPORTANT: Payment Reference</h4>
                <p>Please include this reference in your bank transfer:</p>
                <p style="font-size: 18px; font-weight: bold; color: #d32f2f;">${paymentInstructions.paymentReference}</p>
              </div>
            </div>

            <h3>Next Steps:</h3>
            <ol>
              <li>Make your bank transfer using the details above</li>
              <li>Upload your payment confirmation via your dashboard</li>
              <li>Wait for payment verification from the tournament organizer</li>
              <li>Receive final confirmation and tournament details</li>
            </ol>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_URL}/dashboard" class="btn">View My Dashboard</a>
            </div>
          </div>
          
          <div class="footer">
            <p>Questions? Contact the tournament organizer or visit our help center.</p>
            <p>Australian Sports Tournament Platform</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generatePaymentVerificationHTML(user, tournament, registration, isApproved) {
    const statusColor = isApproved ? '#4caf50' : '#f44336';
    const statusText = isApproved ? 'Payment Confirmed ✅' : 'Payment Issue ❌';
    const message = isApproved 
      ? 'Your payment has been verified and your registration is now confirmed!'
      : 'There was an issue with your payment verification. Please contact the tournament organizer.';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Payment ${isApproved ? 'Confirmed' : 'Issue'}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${statusColor}; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .footer { text-align: center; margin-top: 30px; color: #666; }
          .btn { display: inline-block; background: #2196f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${statusText}</h1>
            <p>${tournament.name}</p>
          </div>
          
          <div class="content">
            <h2>G'day ${user.firstName}!</h2>
            <p>${message}</p>
            
            ${isApproved ? `
              <div style="background: #e8f5e8; border: 2px solid #4caf50; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3>🎉 You're all set!</h3>
                <p>Your registration for ${tournament.name} is now complete. You'll receive additional tournament information closer to the event date.</p>
              </div>
            ` : `
              <div style="background: #ffebee; border: 2px solid #f44336; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3>Action Required</h3>
                <p>Please contact the tournament organizer to resolve the payment issue. You can also try uploading a clearer payment confirmation via your dashboard.</p>
              </div>
            `}

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_URL}/dashboard" class="btn">View My Dashboard</a>
            </div>
          </div>
          
          <div class="footer">
            <p>Australian Sports Tournament Platform</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generateTournamentUpdateHTML(user, tournament, updateType, message) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Tournament Update</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .footer { text-align: center; margin-top: 30px; color: #666; }
          .btn { display: inline-block; background: #2196f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📢 Tournament Update</h1>
            <p>${tournament.name}</p>
          </div>
          
          <div class="content">
            <h2>G'day ${user.firstName}!</h2>
            <p>There's an important update regarding your tournament:</p>
            
            <div style="background: white; border-left: 4px solid #2196f3; padding: 20px; margin: 20px 0;">
              <h3>${updateType}</h3>
              <p>${message}</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_URL}/tournaments/${tournament._id}" class="btn">View Tournament Details</a>
            </div>
          </div>
          
          <div class="footer">
            <p>Australian Sports Tournament Platform</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = new EmailService();