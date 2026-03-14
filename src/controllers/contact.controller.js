import { generateId } from '../utils/crypto';
import { sendEmail, emailTemplates } from '../services/email.service';
import { sendSuccess, sendError } from '../utils/response';

export const submitContactForm = async (c) => {
  const { name, email, subject, message } = await c.req.json();

  const id = generateId();

  await c.env.DB.prepare(
    "INSERT INTO contacts (id, name, email, subject, message) VALUES (?, ?, ?, ?, ?)"
  ).bind(id, name, email, subject || "No Subject", message).run();

  // Background notifications
  c.executionCtx.waitUntil(
    Promise.all([
      sendEmail(c.env.RESEND_API_KEY, c.env.ADMIN_EMAIL, `New Support Ticket: ${subject}`, emailTemplates.adminContactAlert(c, name, email, subject, message)),
      sendEmail(c.env.RESEND_API_KEY, email, "We received your message", emailTemplates.contactConfirmation(c, name))
    ]).catch(console.error)
  );

  return sendSuccess(
    c, 201, 
    { id }, 
    "Message submitted successfully"
  );
};

export const getContactStats = async (c) => {
  const stats = await c.env.DB.prepare(
    "SELECT status, COUNT(*) as count FROM contacts GROUP BY status"
  ).all();
  
  const formattedStats = stats.results.reduce((acc, curr) => {
    acc[curr.status] = curr.count;
    return acc;
  }, { pending: 0, replied: 0, ignored: 0 });

  return sendSuccess(
    c, 200, 
    formattedStats, 
    "Contact stats fetched"
  );
};

export const getAllContacts = async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, name, email, subject, message, status, created_at FROM contacts ORDER BY created_at DESC"
  ).all();

  return sendSuccess(
    c, 200, 
    results
  );
};

export const getContactById = async (c) => {
  const id = c.req.param('id');

  const contact = await c.env.DB.prepare(
    "SELECT * FROM contacts WHERE id = ?"
  ).bind(id).first();

  if (!contact) return sendError(
    c, 404, 
    "Contact message not found"
  );

  return sendSuccess(
    c, 200, 
    contact
  );
};

export const updateContactStatus = async (c) => {
  const id = c.req.param('id');

  const { status } = await c.req.json(); // pending, replied, ignored
  
  const result = await c.env.DB.prepare(
    "UPDATE contacts SET status = ? WHERE id = ?"
  ).bind(status, id).run();
    
  if (result.meta.changes === 0) return sendError(
    c, 404, 
    "Message not found"
  );

  return sendSuccess(
    c, 200, 
    {}, 
    `Status updated to ${status}`
  );
};

export const replyToContact = async (c) => {
  const id = c.req.param('id');

  const { replyMessage } = await c.req.json();

  const contact = await c.env.DB.prepare(
    "SELECT * FROM contacts WHERE id = ?"
  ).bind(id).first();

  if (!contact) return sendError(
    c, 404, 
    "Contact message not found"
  );

  const status = 'replied'
  await c.env.DB.prepare(
    "UPDATE contacts SET status = ? WHERE id = ?"
  ).bind(status, id).run();

  // Send the reply email
  c.executionCtx.waitUntil(
    sendEmail(
      c.env.RESEND_API_KEY, 
      contact.email, 
      `Re: ${contact.subject}`, 
      emailTemplates.contactReply(c, contact.name, contact.subject, contact.message, replyMessage)
    ).then(async () => {
      // Update status to 'replied' once email is sent
      await c.env.DB.prepare(
        "UPDATE contacts SET status = 'replied' WHERE id = ?"
      ).bind(id).run();
    }).catch(console.error)
  );

  return sendSuccess(
    c, 200, 
    {}, 
    "Reply sent successfully"
  );
};

export const deleteContact = async (c) => {
  const id = c.req.param('id');

  await c.env.DB.prepare(
    "DELETE FROM contacts WHERE id = ?"
  ).bind(id).run();

  return sendSuccess(
    c, 200, 
    {}, 
    "Contact record deleted"
  );
};