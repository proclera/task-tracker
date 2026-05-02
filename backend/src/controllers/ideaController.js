const { getDB, saveDB } = require('../config/database');
const { getRow, getRows } = require('../utils/sql');
const { isPlainObject, normalizeOptionalText, toPositiveInt } = require('../utils/validation');
const { createNotification } = require('./notificationController');

const IDEA_STATUSES = ['new', 'under_review', 'approved', 'in_progress', 'rejected'];
const IDEA_PRIORITIES = ['low', 'medium', 'high'];
const IDEA_CATEGORIES = ['general', 'product', 'operations', 'sales', 'team', 'marketing'];

const IDEA_SELECT = `
  SELECT
    i.*,
    u.first_name || ' ' || u.last_name as created_by_name,
    u.email as created_by_email,
    task.title as converted_task_title
  FROM ideas i
  INNER JOIN users u ON u.id = i.created_by
  LEFT JOIN tasks task ON task.id = i.converted_task_id
`;

const normalizeIdeaPayload = (payload, { partial = false } = {}) => {
  const errors = [];
  const idea = {};

  if (!partial || payload.title !== undefined) {
    const title = String(payload.title || '').trim();
    if (!title) {
      errors.push('Title is required');
    } else if (title.length > 160) {
      errors.push('Title must be 160 characters or less');
    } else {
      idea.title = title;
    }
  }

  if (!partial || payload.description !== undefined) {
    const description = String(payload.description || '').trim();
    if (!description) {
      errors.push('Description is required');
    } else if (description.length > 4000) {
      errors.push('Description must be 4000 characters or less');
    } else {
      idea.description = description;
    }
  }

  if (payload.status !== undefined) {
    if (!IDEA_STATUSES.includes(payload.status)) {
      errors.push('Invalid idea status');
    } else {
      idea.status = payload.status;
    }
  }

  if (payload.priority !== undefined) {
    if (!IDEA_PRIORITIES.includes(payload.priority)) {
      errors.push('Invalid idea priority');
    } else {
      idea.priority = payload.priority;
    }
  }

  if (payload.category !== undefined) {
    if (!IDEA_CATEGORIES.includes(payload.category)) {
      errors.push('Invalid idea category');
    } else {
      idea.category = payload.category;
    }
  }

  if (!partial) {
    if (idea.status === undefined) idea.status = 'new';
    if (idea.priority === undefined) idea.priority = 'medium';
    if (idea.category === undefined) idea.category = 'general';
  }

  return { errors, idea };
};

const getIdeaComments = async (db, ideaIds) => {
  if (!ideaIds.length) {
    return [];
  }

  return getRows(
    db,
    `SELECT
       c.*,
       u.first_name || ' ' || u.last_name as author_name
     FROM idea_comments c
     INNER JOIN users u ON u.id = c.user_id
     WHERE c.idea_id = ANY(?::int[])
     ORDER BY c.created_at ASC, c.id ASC`,
    [ideaIds]
  );
};

const buildIdeaResponse = async (db, ideas) => {
  const ideaIds = ideas.map((idea) => idea.id);
  const comments = await getIdeaComments(db, ideaIds);
  const commentsByIdeaId = new Map();

  comments.forEach((comment) => {
    if (!commentsByIdeaId.has(comment.idea_id)) {
      commentsByIdeaId.set(comment.idea_id, []);
    }
    commentsByIdeaId.get(comment.idea_id).push(comment);
  });

  return ideas.map((idea) => ({
    ...idea,
    comments: commentsByIdeaId.get(idea.id) || [],
    comments_count: (commentsByIdeaId.get(idea.id) || []).length
  }));
};

const getAllAdminIds = async (db) => {
  const admins = await getRows(db, `SELECT id FROM users WHERE role = 'admin'`);
  return admins.map((admin) => admin.id);
};

const notifyIdeaParticipants = async (db, idea, actorId, title, message) => {
  const recipients = new Set();
  const admins = await getAllAdminIds(db);
  admins.forEach((id) => {
    if (id !== actorId) {
      recipients.add(id);
    }
  });

  if (idea.created_by && idea.created_by !== actorId) {
    recipients.add(idea.created_by);
  }

  for (const userId of recipients) {
    await createNotification(db, userId, title, message, 'info');
  }
};

const validateAssigneeIds = async (db, assigneeIds) => {
  if (!Array.isArray(assigneeIds)) {
    return { error: 'assignee_ids must be an array' };
  }

  const normalized = [...new Set(assigneeIds.map((item) => toPositiveInt(item)).filter(Boolean))];

  if (normalized.length !== assigneeIds.length) {
    return { error: 'Assigned users must be valid users' };
  }

  if (!normalized.length) {
    return { ids: [] };
  }

  const users = await getRows(db, `SELECT id FROM users WHERE id = ANY(?::int[])`, [normalized]);

  if (users.length !== normalized.length) {
    return { error: 'Assigned users must exist' };
  }

  return { ids: normalized };
};

const validateGoalLink = async (db, goalId) => {
  if (goalId === null || goalId === undefined) {
    return null;
  }

  const goal = await getRow(db, `SELECT id FROM goals WHERE id = ?`, [goalId]);
  return goal ? null : 'Selected goal does not exist';
};

const deriveTaskStatus = (assigneeIds, fallbackStatus = 'pending') => {
  if (!assigneeIds.length) {
    return fallbackStatus;
  }

  return 'pending';
};

const syncTaskAssignments = async (db, taskId, assigneeIds) => {
  await db.run(`DELETE FROM task_assignments WHERE task_id = ?`, [taskId]);

  for (const userId of assigneeIds) {
    await db.run(
      `INSERT INTO task_assignments (task_id, user_id, status, updated_at)
       VALUES (?, ?, 'pending', CURRENT_TIMESTAMP)`,
      [taskId, userId]
    );
  }
};

exports.getIdeas = async (req, res) => {
  try {
    const db = await getDB();
    const ideas = await getRows(db, `${IDEA_SELECT} ORDER BY i.updated_at DESC, i.id DESC`);
    const ideasWithComments = await buildIdeaResponse(db, ideas);

    res.json({
      ideas: ideasWithComments,
      meta: {
        statuses: IDEA_STATUSES,
        priorities: IDEA_PRIORITIES,
        categories: IDEA_CATEGORIES
      }
    });
  } catch (error) {
    console.error('Get ideas error:', error);
    res.status(500).json({ error: 'Failed to fetch ideas' });
  }
};

exports.createIdea = async (req, res) => {
  try {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const db = await getDB();
    const { errors, idea } = normalizeIdeaPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({ error: errors[0] });
    }

    const result = await db.run(
      `INSERT INTO ideas (title, description, status, priority, category, created_by)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING id`,
      [idea.title, idea.description, idea.status, idea.priority, idea.category, req.user.id]
    );

    const createdIdea = await getRow(db, `${IDEA_SELECT} WHERE i.id = ?`, [result.rows[0].id]);
    await notifyIdeaParticipants(
      db,
      createdIdea,
      req.user.id,
      'New Admin Idea',
      `${createdIdea.created_by_name} shared a new idea: ${createdIdea.title}`
    );
    await saveDB();

    const [ideaWithComments] = await buildIdeaResponse(db, [createdIdea]);
    res.status(201).json({ idea: ideaWithComments });
  } catch (error) {
    console.error('Create idea error:', error);
    res.status(500).json({ error: 'Failed to create idea' });
  }
};

exports.updateIdea = async (req, res) => {
  try {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const db = await getDB();
    const ideaId = toPositiveInt(req.params.id);

    if (!ideaId) {
      return res.status(400).json({ error: 'Invalid idea id' });
    }

    const existing = await getRow(db, `${IDEA_SELECT} WHERE i.id = ?`, [ideaId]);

    if (!existing) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    const { errors, idea } = normalizeIdeaPayload(req.body, { partial: true });

    if (errors.length > 0) {
      return res.status(400).json({ error: errors[0] });
    }

    const nextIdea = {
      title: idea.title ?? existing.title,
      description: idea.description ?? existing.description,
      status: idea.status ?? existing.status,
      priority: idea.priority ?? existing.priority,
      category: idea.category ?? existing.category
    };

    await db.run(
      `UPDATE ideas
       SET title = ?, description = ?, status = ?, priority = ?, category = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [nextIdea.title, nextIdea.description, nextIdea.status, nextIdea.priority, nextIdea.category, ideaId]
    );

    const updatedIdea = await getRow(db, `${IDEA_SELECT} WHERE i.id = ?`, [ideaId]);
    if (existing.status !== updatedIdea.status) {
      await notifyIdeaParticipants(
        db,
        updatedIdea,
        req.user.id,
        'Idea Status Updated',
        `Idea "${updatedIdea.title}" moved to ${updatedIdea.status.replace('_', ' ')}`
      );
    }
    await saveDB();

    const [ideaWithComments] = await buildIdeaResponse(db, [updatedIdea]);
    res.json({ idea: ideaWithComments });
  } catch (error) {
    console.error('Update idea error:', error);
    res.status(500).json({ error: 'Failed to update idea' });
  }
};

exports.addIdeaComment = async (req, res) => {
  try {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const db = await getDB();
    const ideaId = toPositiveInt(req.params.id);
    const content = normalizeOptionalText(req.body.content, { maxLength: 1500 });

    if (!ideaId) {
      return res.status(400).json({ error: 'Invalid idea id' });
    }

    if (content.error) {
      return res.status(400).json({ error: content.error });
    }

    if (!content.value) {
      return res.status(400).json({ error: 'Comment is required' });
    }

    const idea = await getRow(db, `${IDEA_SELECT} WHERE i.id = ?`, [ideaId]);

    if (!idea) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    await db.run(
      `INSERT INTO idea_comments (idea_id, user_id, content)
       VALUES (?, ?, ?)`,
      [ideaId, req.user.id, content.value]
    );
    await db.run(`UPDATE ideas SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [ideaId]);

    await notifyIdeaParticipants(
      db,
      idea,
      req.user.id,
      'New Idea Comment',
      `${req.user.firstName} commented on "${idea.title}"`
    );
    await saveDB();

    const refreshedIdea = await getRow(db, `${IDEA_SELECT} WHERE i.id = ?`, [ideaId]);
    const [ideaWithComments] = await buildIdeaResponse(db, [refreshedIdea]);
    res.status(201).json({ idea: ideaWithComments });
  } catch (error) {
    console.error('Add idea comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
};

exports.convertIdeaToTask = async (req, res) => {
  try {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const db = await getDB();
    const ideaId = toPositiveInt(req.params.id);

    if (!ideaId) {
      return res.status(400).json({ error: 'Invalid idea id' });
    }

    const idea = await getRow(db, `${IDEA_SELECT} WHERE i.id = ?`, [ideaId]);

    if (!idea) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    if (idea.converted_task_id) {
      return res.status(400).json({ error: 'Idea is already linked to a task' });
    }

    const assigneeValidation = await validateAssigneeIds(db, req.body.assignee_ids || []);
    if (assigneeValidation.error) {
      return res.status(400).json({ error: assigneeValidation.error });
    }

    const dueDate = req.body.due_date ? String(req.body.due_date).trim() : null;
    const goalId = req.body.goal_id === '' || req.body.goal_id === undefined || req.body.goal_id === null
      ? null
      : toPositiveInt(req.body.goal_id);

    if (req.body.goal_id !== undefined && req.body.goal_id !== '' && !goalId) {
      return res.status(400).json({ error: 'Invalid goal id' });
    }

    const goalError = await validateGoalLink(db, goalId);
    if (goalError) {
      return res.status(400).json({ error: goalError });
    }

    const priority = ['low', 'medium', 'high', 'urgent'].includes(req.body.priority)
      ? req.body.priority
      : idea.priority;

    const initialStatus = deriveTaskStatus(assigneeValidation.ids, 'pending');
    const result = await db.run(
      `INSERT INTO tasks (title, description, status, priority, assignee_id, created_by, due_date, goal_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
      [
        idea.title,
        idea.description,
        initialStatus,
        priority,
        assigneeValidation.ids[0] ?? null,
        req.user.id,
        dueDate,
        goalId
      ]
    );

    const taskId = result.rows[0].id;
    await syncTaskAssignments(db, taskId, assigneeValidation.ids);

    await db.run(
      `UPDATE ideas
       SET converted_task_id = ?, status = 'in_progress', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [taskId, ideaId]
    );

    await notifyIdeaParticipants(
      db,
      idea,
      req.user.id,
      'Idea Converted To Task',
      `Idea "${idea.title}" was converted into a task`
    );
    await saveDB();

    const refreshedIdea = await getRow(db, `${IDEA_SELECT} WHERE i.id = ?`, [ideaId]);
    const [ideaWithComments] = await buildIdeaResponse(db, [refreshedIdea]);
    res.json({ idea: ideaWithComments, taskId });
  } catch (error) {
    console.error('Convert idea to task error:', error);
    res.status(500).json({ error: 'Failed to convert idea to task' });
  }
};

module.exports = {
  getIdeas: exports.getIdeas,
  createIdea: exports.createIdea,
  updateIdea: exports.updateIdea,
  addIdeaComment: exports.addIdeaComment,
  convertIdeaToTask: exports.convertIdeaToTask
};
