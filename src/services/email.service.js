export const sendEmail = async (resendApiKey, to, subject, html) => {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from: 'Allypdf <support@allypdf.com>', to, subject, html })
  });
  if (!res.ok) throw new Error("Failed to send email");
};

// ─── Shared base styles for inline email CSS ─────────────────────────
const getBaseStyles = () => {
  return `
      body { margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #334155; -webkit-font-smoothing: antialiased; }
      .wrapper { background-color: #f8fafc; padding: 48px 20px; }
      .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
      .header { padding: 40px 40px 20px; text-align: center; }
      .logo { height: 40px; margin-bottom: 24px; }
      .logo-text { color: #0d9488; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; text-decoration: none; }
      .header h1 { margin: 0; color: #1e293b; font-size: 28px; font-weight: 500; line-height: 1.2; }
      .content { padding: 0 40px 40px; }
      .content p { color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px; }
      .feature-card { background: #f1f5f9; border-radius: 8px; padding: 24px; margin: 24px 0; border: 1px solid #e2e8f0; text-align: left; }
      .feature-item { display: flex; align-items: flex-start; margin-bottom: 12px; }
      .feature-icon { color: #0d9488; font-weight: bold; margin-right: 12px; font-size: 18px; line-height: 1; }
      .feature-text { font-size: 14px; color: #1e293b; }
      .button { display: inline-block; padding: 14px 32px; background-color: #0d9488; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; }
      .divider { height: 1px; background: #e2e8f0; margin: 32px 0; }
      .footer { padding: 32px 40px; text-align: center; background: #f8fafc; border-top: 1px solid #e2e8f0; }
      .footer-links a { color: #64748b; text-decoration: none; font-size: 13px; margin: 0 10px; }
      .footer-text { color: #94a3b8; font-size: 12px; margin: 8px 0 0; }
    `;
}

const getFooterHtml = (c) => {
  const year = new Date().getFullYear();
  const baseUrl = c.env.CLIENT_URL || 'https://allypdf.com';
  return `
      <div class="footer">
        <div class="footer-links">
          <a href="${baseUrl}/tools">Tools</a>
          <a href="${baseUrl}/privacy">Privacy Policy</a>
          <a href="${baseUrl}/terms">Terms of Service</a>
        </div>
        <p class="footer-text">&copy; ${year} Allypdf. Professional Document Solutions.</p>
      </div>
    `;
}

export const emailTemplates = {
  welcome: (c, name) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>${getBaseStyles()}</style>
    </head>
    <body>
      <div class="wrapper">
        <div class="container">
          <div class="header">
            <h1>Welcome to Allypdf, ${name}!</h1>
          </div>
          <div class="content">
            <p>We're thrilled to have you here. Allypdf provides a suite of fast, secure, and private document tools built to work directly in your browser.</p>
            
            <div class="feature-card">
              <p style="margin-top: 0; font-weight: 600; color: #1e293b; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">Your Quick Start Guide:</p>
              <div class="feature-item">
                <span class="feature-icon">✓</span>
                <span class="feature-text"><strong>Convert:</strong> Switch between PDF, HTML and Image formats.</span>
              </div>
              <div class="feature-item">
                <span class="feature-icon">✓</span>
                <span class="feature-text"><strong>Edit:</strong> Professional tools to crop and resize your files.</span>
              </div>
              <div class="feature-item">
                <span class="feature-icon">✓</span>
                <span class="feature-text"><strong>Secure:</strong> Advanced encryption for all sensitive documents.</span>
              </div>
            </div>

            <div style="text-align: center; margin: 40px 0;">
              <a href="https://allypdf.com" class="button">Start Your First Project</a>
            </div>

            <p style="text-align: center; font-size: 14px;">
              Have a question? Simply reply to this email to reach our support team.
            </p>
          </div>
          ${getFooterHtml(c)}
        </div>
      </div>
    </body>
    </html>
  `,

  resetPassword: (c, resetLink) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>${getBaseStyles()}</style>
    </head>
    <body>
      <div class="wrapper">
        <div class="container">
          <div class="header">
            <h1>Reset your password</h1>
          </div>
          <div class="content">
            <p>We received a request to reset the password for your Allypdf account. Click the button below to choose a new one:</p>
            
            <div style="text-align: center; margin: 40px 0;">
              <a href="${resetLink}" class="button">Reset Password</a>
            </div>

            <div class="info-card">
              <div class="label" style="color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 8px;">Security Note</div>
              <p style="font-size: 14px; margin: 0; color: #475569;">
                This link is valid for <strong style="color: #0d9488;">10 minutes</strong>. If you didn't request a password reset, you can safely ignore this email; your account is still secure.
              </p>
            </div>

            <div class="divider"></div>

            <p style="font-size: 12px; color: #94a3b8; line-height: 1.4;">
              If you're having trouble clicking the button, copy and paste the URL below into your web browser: <br>
              <span style="word-break: break-all; color: #0d9488;">${resetLink}</span>
            </p>
          </div>
          ${getFooterHtml(c)}
        </div>
      </div>
    </body>
    </html>
  `,

  deviceVerification: (c, code) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>${getBaseStyles()}</style>
    </head>
    <body>
      <div class="wrapper">
        <div class="container">
          <div class="header">
            <h1>Verify your login</h1>
          </div>
          <div class="content">
            <p>A new login attempt was detected for your Allypdf account. Please use the verification code below to authorize this session:</p>
            
            <div class="otp-container" style="background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 32px; text-align: center; margin: 24px 0;">
              <div class="label" style="color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Verification Code</div>
              <div class="otp-code" style="font-family: 'Courier New', monospace; font-size: 42px; font-weight: 800; color: #0d9488; letter-spacing: 8px; margin: 0;">${code}</div>
            </div>

            <div style="background: #fff1f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-top: 24px;">
              <p style="color: #991b1b; font-size: 13px; margin: 0; line-height: 1.5;">
                <strong>Security Alert:</strong> If you did not attempt this login, please change your password immediately to secure your account.
              </p>
            </div>
          </div>
          ${getFooterHtml(c)}
        </div>
      </div>
    </body>
    </html>
  `,

  contactConfirmation: (c, name) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>${getBaseStyles()}</style>
    </head>
    <body>
      <div class="wrapper">
        <div class="container">
          <div class="header">
            <h1>Message Received</h1>
          </div>
          <div class="content">
            <p>Hi <span class="highlight">${name}</span>,</p>
            <p>Thank you for reaching out to us! We've successfully received your inquiry and our support team is currently reviewing it.</p>

            <div class="info-card">
              <div style="margin-bottom: 16px;">
                <div style="display: flex; align-items: flex-start;">
                  <span style="color: #0d9488; margin-right: 12px; font-size: 18px;">⏱</span>
                  <div>
                    <div class="label" style="margin-bottom: 0;">Response Time</div>
                    <div class="value" style="font-size: 14px;">We typically respond within 24 hours during business days.</div>
                  </div>
                </div>
              </div>
              <div style="margin-bottom: 16px;">
                <div style="display: flex; align-items: flex-start;">
                  <span style="color: #0d9488; margin-right: 12px; font-size: 18px;">📧</span>
                  <div>
                    <div class="label" style="margin-bottom: 0;">Reply Method</div>
                    <div class="value" style="font-size: 14px;">Our team will respond directly to your provided email address.</div>
                  </div>
                </div>
              </div>
              <div>
                <div style="display: flex; align-items: flex-start;">
                  <span style="color: #0d9488; margin-right: 12px; font-size: 18px;">🔒</span>
                  <div>
                    <div class="label" style="margin-bottom: 0;">Privacy</div>
                    <div class="value" style="font-size: 14px;">Your information is kept secure and handled with strict confidentiality.</div>
                  </div>
                </div>
              </div>
            </div>

            <p style="text-align: center;">In the meantime, feel free to explore our collection of PDF and image tools:</p>

            <div style="text-align: center; margin: 32px 0;">
              <a href="${c.env.CLIENT_URL || 'https://allypdf.com'}" class="button">Explore Tools</a>
            </div>

            <div class="divider"></div>
            
            <p style="color: #94a3b8; font-size: 12px; text-align: center; line-height: 1.5;">
              This is an automated confirmation email. Please do not reply directly to this message. <br>
              Need to add more details? Use our <a href="${c.env.CLIENT_URL || 'https://allypdf.com'}/contact" style="color: #0d9488; text-decoration: none; font-weight: 600;">contact form</a>.
            </p>
          </div>
          ${getFooterHtml(c)}
        </div>
      </div>
    </body>
    </html>
  `,

  adminContactAlert: (c, name, email, subject, message, formattedDate = new Date().toLocaleString()) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>${getBaseStyles()}</style>
    </head>
    <body>
      <div class="wrapper">
        <div class="container">
          <div class="header">
            <h1>New Support Inquiry</h1>
          </div>
          <div class="content">
            <p>A new contact form has been submitted on <strong>Allypdf</strong>. Here are the submission details:</p>

            <div class="info-card">
              <div style="margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px;">
                <div class="label">From</div>
                <div class="value" style="color: #0d9488;">${name}</div>
              </div>
              <div style="margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px;">
                <div class="label">Email Address</div>
                <div class="value"><a href="mailto:${email}" style="color: #0d9488; text-decoration: none;">${email}</a></div>
              </div>
              <div style="margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px;">
                <div class="label">Subject</div>
                <div class="value">${subject}</div>
              </div>
              <div>
                <div class="label">Submitted On</div>
                <div class="value" style="font-size: 13px;">${formattedDate}</div>
              </div>
            </div>

            <div class="label" style="margin-left: 4px; margin-bottom: 8px;">Message Content</div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px;">
              <p style="color: #1e293b; font-size: 15px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${message}</p>
            </div>

            <div style="text-align: center; margin: 40px 0;">
              <a href="${c.env.CLIENT_URL || 'https://allypdf.com'}/admin" class="button">View in Admin Panel</a>
            </div>

            <div class="divider"></div>
            <p style="color: #94a3b8; font-size: 12px; text-align: center; line-height: 1.4;">
              This is an automated administrative notification from the Allypdf contact system.<br>
              Manage all user submissions via the secure admin dashboard.
            </p>
          </div>
          ${getFooterHtml(c)}
        </div>
      </div>
    </body>
    </html>
  `,

  contactReply: (c, name, originalSubject, originalMessage, replyMessage) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>${getBaseStyles()}</style>
    </head>
    <body>
      <div class="wrapper">
        <div class="container">
          <div class="header">
            <h1>Re: ${originalSubject}</h1>
          </div>
          <div class="content">
            <p>Hi <span class="highlight">${name}</span>,</p>
            <p>Thank you for reaching out to us. Our support team has reviewed your inquiry and provided a response below:</p>

            <div class="info-card" style="border-left: 4px solid #0d9488; background: #f1f5f9; padding: 20px;">
              <div class="label" style="margin-bottom: 8px;">Our Reply</div>
              <p style="color: #1e293b; font-size: 15px; line-height: 1.6; white-space: pre-wrap; margin: 0;">${replyMessage}</p>
            </div>

            <div class="divider"></div>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; opacity: 0.8;">
              <div class="label" style="margin-bottom: 8px;">Your Original Message</div>
              <div style="font-size: 13px; font-weight: 600; color: #64748b; margin-bottom: 4px;">Subject: ${originalSubject}</div>
              <p style="color: #64748b; font-size: 13px; margin: 0; white-space: pre-wrap;">${originalMessage}</p>
            </div>

            <div class="divider"></div>

            <p style="text-align: center; font-size: 14px;">If you have any further questions, simply reply to this email or visit our contact page.</p>

            <div style="text-align: center; margin: 32px 0;">
              <a href="${c.env.CLIENT_URL || 'https://allypdf.com'}/contact" class="button">Contact Support Again</a>
            </div>

            <p style="color: #94a3b8; font-size: 13px; text-align: center;">
              We appreciate your feedback and are always here to help. <br>
              Thank you for choosing <strong>Allypdf</strong>!
            </p>
          </div>
          ${getFooterHtml(c)}
        </div>
      </div>
    </body>
    </html>
  `
};
