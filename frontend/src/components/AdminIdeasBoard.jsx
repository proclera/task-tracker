import { useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';

const EMPTY_IDEA_FORM = {
  title: '',
  description: '',
  category: 'general',
  priority: 'medium'
};

const EMPTY_CONVERT_FORM = {
  due_date: '',
  goal_id: '',
  priority: 'medium',
  assignee_ids: []
};

const statusLabels = {
  new: 'New',
  under_review: 'Under Review',
  approved: 'Approved',
  in_progress: 'In Progress',
  rejected: 'Rejected'
};

export const AdminIdeasBoard = () => {
  const [ideas, setIdeas] = useState([]);
  const [meta, setMeta] = useState({ statuses: [], priorities: [], categories: [] });
  const [ideaForm, setIdeaForm] = useState(EMPTY_IDEA_FORM);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [convertForms, setConvertForms] = useState({});
  const [expandedIdeaId, setExpandedIdeaId] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingIdea, setSavingIdea] = useState(false);
  const [busyIdeaId, setBusyIdeaId] = useState(null);
  const [error, setError] = useState('');
  const { showToast } = useToast();

  const loadBoard = async () => {
    try {
      setLoading(true);
      setError('');
      const [ideasResponse, employeesResponse, goalsResponse] = await Promise.all([
        api.get('/ideas'),
        api.get('/employees'),
        api.get('/goals')
      ]);

      setIdeas(ideasResponse.data.ideas || []);
      setMeta(ideasResponse.data.meta || { statuses: [], priorities: [], categories: [] });
      setEmployees((employeesResponse.data.employees || []).filter((employee) => employee.role !== 'admin'));
      setGoals(goalsResponse.data.goals || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load ideas board');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoard();
  }, []);

  const summaryCards = useMemo(() => {
    const counts = ideas.reduce((accumulator, idea) => {
      accumulator[idea.status] = (accumulator[idea.status] || 0) + 1;
      return accumulator;
    }, {});

    return [
      { label: 'Total Ideas', value: ideas.length, accent: 'linear-gradient(135deg, #2563eb, #60a5fa)' },
      { label: 'Under Review', value: counts.under_review || 0, accent: 'linear-gradient(135deg, #d97706, #fbbf24)' },
      { label: 'Approved', value: counts.approved || 0, accent: 'linear-gradient(135deg, #059669, #34d399)' },
      { label: 'Converted', value: ideas.filter((idea) => idea.converted_task_id).length, accent: 'linear-gradient(135deg, #7c3aed, #a78bfa)' }
    ];
  }, [ideas]);

  const updateIdeaForm = (key, value) => {
    setIdeaForm((current) => ({
      ...current,
      [key]: value
    }));
  };

  const createIdea = async (event) => {
    event.preventDefault();

    try {
      setSavingIdea(true);
      setError('');
      const response = await api.post('/ideas', ideaForm);
      setIdeas((current) => [response.data.idea, ...current]);
      setIdeaForm(EMPTY_IDEA_FORM);
      showToast('Idea shared successfully', 'success');
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to create idea';
      setError(message);
      showToast(message, 'error');
    } finally {
      setSavingIdea(false);
    }
  };

  const replaceIdea = (nextIdea) => {
    setIdeas((current) => current.map((idea) => (idea.id === nextIdea.id ? nextIdea : idea)));
  };

  const updateIdeaField = async (ideaId, payload) => {
    try {
      setBusyIdeaId(ideaId);
      const response = await api.put(`/ideas/${ideaId}`, payload);
      replaceIdea(response.data.idea);
      showToast('Idea updated', 'success');
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to update idea';
      setError(message);
      showToast(message, 'error');
    } finally {
      setBusyIdeaId(null);
    }
  };

  const addComment = async (ideaId) => {
    const content = String(commentDrafts[ideaId] || '').trim();

    if (!content) {
      return;
    }

    try {
      setBusyIdeaId(ideaId);
      const response = await api.post(`/ideas/${ideaId}/comments`, { content });
      replaceIdea(response.data.idea);
      setCommentDrafts((current) => ({ ...current, [ideaId]: '' }));
      showToast('Comment added', 'success');
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to add comment';
      setError(message);
      showToast(message, 'error');
    } finally {
      setBusyIdeaId(null);
    }
  };

  const toggleAssignee = (ideaId, userId) => {
    setConvertForms((current) => {
      const form = current[ideaId] || { ...EMPTY_CONVERT_FORM };
      const alreadySelected = form.assignee_ids.includes(userId);

      return {
        ...current,
        [ideaId]: {
          ...form,
          assignee_ids: alreadySelected
            ? form.assignee_ids.filter((id) => id !== userId)
            : [...form.assignee_ids, userId]
        }
      };
    });
  };

  const updateConvertForm = (ideaId, key, value) => {
    setConvertForms((current) => ({
      ...current,
      [ideaId]: {
        ...(current[ideaId] || EMPTY_CONVERT_FORM),
        [key]: value
      }
    }));
  };

  const convertIdeaToTask = async (ideaId) => {
    const payload = convertForms[ideaId] || EMPTY_CONVERT_FORM;

    try {
      setBusyIdeaId(ideaId);
      const response = await api.post(`/ideas/${ideaId}/convert-to-task`, {
        ...payload,
        goal_id: payload.goal_id || null
      });
      replaceIdea(response.data.idea);
      setExpandedIdeaId(null);
      showToast('Idea converted to task', 'success');
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to convert idea';
      setError(message);
      showToast(message, 'error');
    } finally {
      setBusyIdeaId(null);
    }
  };

  if (loading) {
    return <div style={styles.loading}>Loading ideas board...</div>;
  }

  return (
    <section style={styles.container}>
      <div style={styles.hero}>
        <div>
          <h2 style={styles.title}>Ideas Hub</h2>
          <p style={styles.subtitle}>
            Share admin ideas, discuss them with comments, move them through review, and convert strong ones into tasks.
          </p>
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.summaryGrid}>
        {summaryCards.map((card) => (
          <div key={card.label} style={{ ...styles.summaryCard, background: card.accent }}>
            <div style={styles.summaryValue}>{card.value}</div>
            <div style={styles.summaryLabel}>{card.label}</div>
          </div>
        ))}
      </div>

      <div style={styles.twoColumn}>
        <form onSubmit={createIdea} style={styles.composeCard}>
          <div>
            <h3 style={styles.cardTitle}>Share New Idea</h3>
            <p style={styles.cardSubtitle}>Drop a practical idea, process improvement, or growth experiment for the team.</p>
          </div>

          <input
            type="text"
            value={ideaForm.title}
            onChange={(event) => updateIdeaForm('title', event.target.value)}
            placeholder="Idea title"
            style={styles.input}
            required
          />
          <textarea
            value={ideaForm.description}
            onChange={(event) => updateIdeaForm('description', event.target.value)}
            placeholder="Describe the idea, expected outcome, and why it matters."
            style={styles.textarea}
            rows={5}
            required
          />
          <div style={styles.formRow}>
            <select
              value={ideaForm.category}
              onChange={(event) => updateIdeaForm('category', event.target.value)}
              style={styles.select}
            >
              {meta.categories.map((category) => (
                <option key={category} value={category}>{formatLabel(category)}</option>
              ))}
            </select>
            <select
              value={ideaForm.priority}
              onChange={(event) => updateIdeaForm('priority', event.target.value)}
              style={styles.select}
            >
              {meta.priorities.map((priority) => (
                <option key={priority} value={priority}>{formatLabel(priority)} Priority</option>
              ))}
            </select>
          </div>
          <button type="submit" style={styles.primaryButton} disabled={savingIdea}>
            {savingIdea ? 'Sharing...' : 'Share Idea'}
          </button>
        </form>

        <div style={styles.tipCard}>
          <h3 style={styles.cardTitle}>Good Idea Template</h3>
          <div style={styles.tipList}>
            <div style={styles.tipItem}><strong>Problem:</strong> What is not working right now?</div>
            <div style={styles.tipItem}><strong>Proposal:</strong> What exact change do you want to try?</div>
            <div style={styles.tipItem}><strong>Impact:</strong> Time saving, sales growth, cleaner workflow, or better quality.</div>
            <div style={styles.tipItem}><strong>Next Step:</strong> If approved, who should own the first action?</div>
          </div>
        </div>
      </div>

      <div style={styles.list}>
        {ideas.length === 0 ? (
          <div style={styles.empty}>No ideas shared yet.</div>
        ) : (
          ideas.map((idea) => {
            const convertForm = convertForms[idea.id] || EMPTY_CONVERT_FORM;
            const isExpanded = expandedIdeaId === idea.id;

            return (
              <div key={idea.id} style={styles.ideaCard}>
                <div style={styles.ideaTop}>
                  <div style={styles.ideaTopLeft}>
                    <div style={styles.ideaTitleRow}>
                      <h3 style={styles.ideaTitle}>{idea.title}</h3>
                      <span style={{ ...styles.statusBadge, ...statusStyles[idea.status] }}>
                        {statusLabels[idea.status] || formatLabel(idea.status)}
                      </span>
                    </div>
                    <div style={styles.ideaMeta}>
                      <span>{idea.created_by_name}</span>
                      <span>{formatLabel(idea.category)}</span>
                      <span>{formatLabel(idea.priority)} priority</span>
                      <span>{idea.comments_count || 0} comments</span>
                    </div>
                  </div>
                  <div style={styles.ideaActions}>
                    <select
                      value={idea.status}
                      onChange={(event) => updateIdeaField(idea.id, { status: event.target.value })}
                      style={styles.inlineSelect}
                      disabled={busyIdeaId === idea.id}
                    >
                      {meta.statuses.map((status) => (
                        <option key={status} value={status}>{statusLabels[status] || formatLabel(status)}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      style={styles.secondaryButton}
                      onClick={() => setExpandedIdeaId(isExpanded ? null : idea.id)}
                    >
                      {isExpanded ? 'Hide Convert' : 'Convert To Task'}
                    </button>
                  </div>
                </div>

                <p style={styles.ideaDescription}>{idea.description}</p>

                {idea.converted_task_id && (
                  <div style={styles.convertedBar}>
                    Linked task #{idea.converted_task_id}: {idea.converted_task_title || 'Task created'}
                  </div>
                )}

                <div style={styles.commentSection}>
                  <div style={styles.commentTitle}>Discussion</div>
                  {idea.comments?.length ? (
                    <div style={styles.commentList}>
                      {idea.comments.map((comment) => (
                        <div key={comment.id} style={styles.commentItem}>
                          <div style={styles.commentAuthor}>{comment.author_name}</div>
                          <div style={styles.commentContent}>{comment.content}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={styles.commentEmpty}>No comments yet. Start the discussion.</div>
                  )}
                  <div style={styles.commentComposer}>
                    <textarea
                      value={commentDrafts[idea.id] || ''}
                      onChange={(event) => setCommentDrafts((current) => ({ ...current, [idea.id]: event.target.value }))}
                      placeholder="Add your thoughts, concerns, or next step..."
                      rows={3}
                      style={styles.commentInput}
                    />
                    <button
                      type="button"
                      style={styles.commentButton}
                      onClick={() => addComment(idea.id)}
                      disabled={busyIdeaId === idea.id}
                    >
                      Comment
                    </button>
                  </div>
                </div>

                {isExpanded && !idea.converted_task_id && (
                  <div style={styles.convertPanel}>
                    <h4 style={styles.convertTitle}>Convert Idea To Task</h4>
                    <div style={styles.formRow}>
                      <select
                        value={convertForm.priority}
                        onChange={(event) => updateConvertForm(idea.id, 'priority', event.target.value)}
                        style={styles.select}
                      >
                        <option value="low">Low Priority</option>
                        <option value="medium">Medium Priority</option>
                        <option value="high">High Priority</option>
                        <option value="urgent">Urgent</option>
                      </select>
                      <input
                        type="date"
                        value={convertForm.due_date}
                        onChange={(event) => updateConvertForm(idea.id, 'due_date', event.target.value)}
                        style={styles.select}
                      />
                    </div>
                    <select
                      value={convertForm.goal_id}
                      onChange={(event) => updateConvertForm(idea.id, 'goal_id', event.target.value)}
                      style={styles.select}
                    >
                      <option value="">No linked goal</option>
                      {goals.map((goal) => (
                        <option key={goal.id} value={goal.id}>{goal.title}</option>
                      ))}
                    </select>
                    <div style={styles.assignmentPanel}>
                      <div style={styles.assignmentHeader}>
                        <span style={styles.assignmentTitle}>Assign owners</span>
                        <span style={styles.assignmentCount}>{convertForm.assignee_ids.length} selected</span>
                      </div>
                      <div style={styles.assignmentGrid}>
                        {employees.map((employee) => {
                          const selected = convertForm.assignee_ids.includes(employee.id);

                          return (
                            <label
                              key={employee.id}
                              style={{
                                ...styles.assigneeOption,
                                ...(selected ? styles.assigneeOptionSelected : {})
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => toggleAssignee(idea.id, employee.id)}
                              />
                              <span>{employee.first_name} {employee.last_name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <button
                      type="button"
                      style={styles.primaryButton}
                      onClick={() => convertIdeaToTask(idea.id)}
                      disabled={busyIdeaId === idea.id}
                    >
                      {busyIdeaId === idea.id ? 'Converting...' : 'Create Task From Idea'}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};

const formatLabel = (value) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());

const statusStyles = {
  new: { background: '#dbeafe', color: '#1d4ed8' },
  under_review: { background: '#fef3c7', color: '#b45309' },
  approved: { background: '#dcfce7', color: '#15803d' },
  in_progress: { background: '#ede9fe', color: '#7c3aed' },
  rejected: { background: '#fee2e2', color: '#b91c1c' }
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    padding: '1rem'
  },
  hero: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    alignItems: 'flex-start'
  },
  title: {
    fontSize: '1.8rem',
    margin: 0,
    color: '#172554'
  },
  subtitle: {
    margin: '0.45rem 0 0',
    color: '#52607a',
    maxWidth: '720px',
    lineHeight: 1.5
  },
  error: {
    padding: '1rem',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #fff1f1, #ffe4e4)',
    color: '#9d1c1c'
  },
  loading: {
    padding: '2rem',
    textAlign: 'center',
    color: '#52607a'
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '1rem'
  },
  summaryCard: {
    color: 'white',
    padding: '1.2rem',
    borderRadius: '20px',
    boxShadow: '0 18px 44px rgba(31, 45, 76, 0.14)'
  },
  summaryValue: {
    fontSize: '2rem',
    fontWeight: 800,
    marginBottom: '0.25rem'
  },
  summaryLabel: {
    fontWeight: 700
  },
  twoColumn: {
    display: 'grid',
    gridTemplateColumns: 'minmax(320px, 1.1fr) minmax(260px, 0.9fr)',
    gap: '1rem'
  },
  composeCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    padding: '1.2rem',
    borderRadius: '22px',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,250,255,0.95))',
    border: '1px solid rgba(122, 145, 184, 0.16)',
    boxShadow: '0 18px 42px rgba(31, 45, 76, 0.08)'
  },
  tipCard: {
    padding: '1.2rem',
    borderRadius: '22px',
    background: 'linear-gradient(135deg, #142850, #1f4b8f)',
    color: 'white',
    boxShadow: '0 18px 42px rgba(31, 45, 76, 0.12)'
  },
  cardTitle: {
    margin: 0,
    color: 'inherit'
  },
  cardSubtitle: {
    margin: '0.4rem 0 0',
    color: '#62728c',
    lineHeight: 1.5
  },
  tipList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
    marginTop: '1rem'
  },
  tipItem: {
    lineHeight: 1.5,
    color: 'rgba(255,255,255,0.92)'
  },
  input: {
    width: '100%',
    padding: '0.85rem 0.95rem',
    borderRadius: '14px',
    border: '1px solid #d4dceb',
    fontSize: '1rem'
  },
  textarea: {
    width: '100%',
    padding: '0.85rem 0.95rem',
    borderRadius: '14px',
    border: '1px solid #d4dceb',
    fontSize: '1rem',
    resize: 'vertical'
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '0.85rem'
  },
  select: {
    width: '100%',
    padding: '0.85rem 0.95rem',
    borderRadius: '14px',
    border: '1px solid #d4dceb',
    fontSize: '1rem'
  },
  primaryButton: {
    padding: '0.85rem 1.1rem',
    borderRadius: '14px',
    border: 'none',
    background: 'linear-gradient(135deg, #1e63d4, #3a82ff)',
    color: 'white',
    fontWeight: 700,
    cursor: 'pointer'
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem'
  },
  ideaCard: {
    padding: '1.2rem',
    borderRadius: '22px',
    background: 'white',
    border: '1px solid rgba(122, 145, 184, 0.14)',
    boxShadow: '0 18px 42px rgba(31, 45, 76, 0.08)'
  },
  ideaTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
    flexWrap: 'wrap'
  },
  ideaTopLeft: {
    flex: 1,
    minWidth: 0
  },
  ideaTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.7rem',
    flexWrap: 'wrap'
  },
  ideaTitle: {
    margin: 0,
    color: '#183153'
  },
  statusBadge: {
    padding: '0.35rem 0.7rem',
    borderRadius: '999px',
    fontSize: '0.78rem',
    fontWeight: 800
  },
  ideaMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.8rem',
    marginTop: '0.45rem',
    color: '#667892',
    fontSize: '0.88rem'
  },
  ideaActions: {
    display: 'flex',
    gap: '0.65rem',
    flexWrap: 'wrap'
  },
  inlineSelect: {
    padding: '0.65rem 0.8rem',
    borderRadius: '12px',
    border: '1px solid #d4dceb',
    background: 'white'
  },
  secondaryButton: {
    padding: '0.7rem 1rem',
    borderRadius: '12px',
    border: '1px solid #cad7ec',
    background: '#f8fbff',
    color: '#274067',
    fontWeight: 700,
    cursor: 'pointer'
  },
  ideaDescription: {
    margin: '0.95rem 0',
    color: '#44556f',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap'
  },
  convertedBar: {
    padding: '0.8rem 0.95rem',
    borderRadius: '14px',
    background: '#eef6ff',
    color: '#1d4ed8',
    fontWeight: 700,
    marginBottom: '0.95rem'
  },
  commentSection: {
    borderTop: '1px solid #edf2f9',
    paddingTop: '0.95rem'
  },
  commentTitle: {
    color: '#183153',
    fontWeight: 700,
    marginBottom: '0.75rem'
  },
  commentList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.65rem',
    marginBottom: '0.85rem'
  },
  commentItem: {
    padding: '0.8rem 0.9rem',
    borderRadius: '14px',
    background: '#f7faff'
  },
  commentAuthor: {
    color: '#183153',
    fontWeight: 700,
    marginBottom: '0.25rem'
  },
  commentContent: {
    color: '#4b5b74',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap'
  },
  commentEmpty: {
    padding: '0.9rem',
    borderRadius: '14px',
    background: '#f7faff',
    color: '#708096',
    marginBottom: '0.85rem'
  },
  commentComposer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.7rem'
  },
  commentInput: {
    width: '100%',
    padding: '0.8rem 0.9rem',
    borderRadius: '14px',
    border: '1px solid #d4dceb',
    resize: 'vertical'
  },
  commentButton: {
    alignSelf: 'flex-start',
    padding: '0.7rem 0.95rem',
    borderRadius: '12px',
    border: 'none',
    background: '#183153',
    color: 'white',
    fontWeight: 700,
    cursor: 'pointer'
  },
  convertPanel: {
    marginTop: '1rem',
    padding: '1rem',
    borderRadius: '18px',
    background: 'linear-gradient(180deg, rgba(244,248,255,0.98), rgba(236,243,255,0.96))',
    border: '1px solid #d7e2f2',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem'
  },
  convertTitle: {
    margin: 0,
    color: '#183153'
  },
  assignmentPanel: {
    border: '1px solid #d4dceb',
    borderRadius: '16px',
    padding: '0.9rem',
    background: '#f8fbff'
  },
  assignmentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '0.75rem'
  },
  assignmentTitle: {
    fontWeight: 700,
    color: '#183153'
  },
  assignmentCount: {
    fontSize: '0.85rem',
    color: '#62728c'
  },
  assignmentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '0.6rem'
  },
  assigneeOption: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.55rem',
    padding: '0.7rem 0.8rem',
    borderRadius: '12px',
    background: 'white',
    border: '1px solid #d4dceb',
    cursor: 'pointer'
  },
  assigneeOptionSelected: {
    borderColor: '#3a82ff',
    boxShadow: '0 0 0 1px rgba(58, 130, 255, 0.18)'
  },
  empty: {
    padding: '1rem',
    textAlign: 'center',
    color: '#708096',
    background: '#f7faff',
    borderRadius: '14px'
  }
};
