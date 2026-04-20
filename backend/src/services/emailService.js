const EMAIL_PROVIDER = (process.env.EMAIL_PROVIDER || '').trim().toLowerCase();
const EMAIL_FROM = (process.env.EMAIL_FROM || '').trim();
const RESEND_API_KEY = (process.env.RESEND_API_KEY || '').trim();

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const isEmailConfigured = () =>
  EMAIL_PROVIDER === 'resend' && Boolean(EMAIL_FROM) && Boolean(RESEND_API_KEY);

const sendResendEmail = async ({ to, subject, html, text }) => {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend email failed (${response.status}): ${body}`);
  }
};

const sendEmail = async ({ to, subject, html, text }) => {
  if (!isEmailConfigured()) {
    return { sent: false, reason: 'email_not_configured' };
  }

  if (EMAIL_PROVIDER === 'resend') {
    await sendResendEmail({ to, subject, html, text });
    return { sent: true };
  }

  return { sent: false, reason: 'unsupported_email_provider' };
};

const sendTaskNotificationEmail = async ({
  to,
  recipientName,
  heading,
  subject,
  intro,
  detailLines = [],
  closing = 'Please log in to the task tracker to review the latest details.'
}) => {
  const safeRecipientName = recipientName || 'Team member';
  const safeHeading = escapeHtml(heading);
  const safeIntro = escapeHtml(intro);
  const safeClosing = escapeHtml(closing);

  return sendEmail({
    to,
    subject,
    text: [
      `Hello ${safeRecipientName},`,
      '',
      intro,
      ...detailLines,
      '',
      closing
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #183153;">
        <h2 style="margin-bottom: 12px;">${safeHeading}</h2>
        <p>Hello ${escapeHtml(safeRecipientName)},</p>
        <p>${safeIntro}</p>
        ${detailLines.length > 0
          ? `<p>${detailLines.map((line) => escapeHtml(line)).join('<br />')}</p>`
          : ''}
        <p>${safeClosing}</p>
      </div>
    `
  });
};

const sendTaskAssignmentEmail = async ({ to, assigneeName, taskTitle, dueDate, assignedByName }) => {
  const dueDateLine = dueDate ? `Due date: ${dueDate}` : 'Due date: Not set';
  const assignedByLine = assignedByName ? `Assigned by: ${assignedByName}` : 'Assigned by: Admin';
  const safeAssigneeName = assigneeName || 'Team member';

  return sendTaskNotificationEmail({
    to,
    recipientName: safeAssigneeName,
    heading: 'New task assigned',
    subject: `New task assigned: ${taskTitle}`,
    intro: `A new task has been assigned to you: ${taskTitle}`,
    detailLines: [assignedByLine, dueDateLine]
  });
};

const sendTaskUpdateEmail = async ({
  to,
  recipientName,
  taskTitle,
  updatedByName,
  status,
  dueDate,
  changeSummary
}) => {
  const detailLines = [
    updatedByName ? `Updated by: ${updatedByName}` : null,
    status ? `Current status: ${status}` : null,
    dueDate ? `Due date: ${dueDate}` : 'Due date: Not set',
    changeSummary || null
  ].filter(Boolean);

  return sendTaskNotificationEmail({
    to,
    recipientName,
    heading: 'Task updated',
    subject: `Task updated: ${taskTitle}`,
    intro: `The task "${taskTitle}" has been updated.`,
    detailLines
  });
};

const sendTaskProgressEmail = async ({
  to,
  recipientName,
  taskTitle,
  actorName,
  assigneeStatus,
  overallStatus,
  comment
}) => {
  const detailLines = [
    actorName ? `Updated by: ${actorName}` : null,
    assigneeStatus ? `Assignee progress: ${assigneeStatus}` : null,
    overallStatus ? `Overall task status: ${overallStatus}` : null,
    comment ? `Comment: ${comment}` : null
  ].filter(Boolean);

  return sendTaskNotificationEmail({
    to,
    recipientName,
    heading: 'Task progress updated',
    subject: `Task progress updated: ${taskTitle}`,
    intro: `Progress changed on task "${taskTitle}".`,
    detailLines
  });
};

module.exports = {
  isEmailConfigured,
  sendEmail,
  sendTaskAssignmentEmail,
  sendTaskUpdateEmail,
  sendTaskProgressEmail
};
