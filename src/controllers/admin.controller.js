import { sendSuccess, sendError } from '../utils/response';

export const getAdminStats = async (c) => {
  // Parallel execution for speed on the Edge
  const stats = await c.env.DB.batch([
    c.env.DB.prepare("SELECT COUNT(*) as total FROM users"),
    c.env.DB.prepare("SELECT COUNT(*) as total FROM sessions"),
    c.env.DB.prepare("SELECT COUNT(*) as total FROM contacts WHERE status = 'pending'")
  ]);

  return sendSuccess(
    c, 200, 
    {
      totalUsers: stats[0].results[0].total,
      activeSessions: stats[1].results[0].total,
      pendingInquiries: stats[2].results[0].total
    }
  );
};

export const getAllUsers = async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, fullName, email, role, created_at FROM users ORDER BY created_at DESC"
  ).all();

  return sendSuccess(
    c, 200, 
    results
  );
};

export const updateUserSettings = async (c) => {
  const { userId, role } = await c.req.json();

  await c.env.DB.prepare(
    "UPDATE users SET role = ? WHERE id = ?"
  ).bind(role, userId).run();

  return sendSuccess(
    c, 200, 
    {}, 
    "User role updated."
  );
};