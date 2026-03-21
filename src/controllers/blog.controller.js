import { generateId } from '../utils/crypto';
import { sendSuccess, sendError } from '../utils/response';

// --- PUBLIC ENDPOINTS ---

export const getPublishedPosts = async (c) => {
  const { category, tag, search, page = 1, limit = 12 } = c.req.query();
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let queryStr = "FROM blogs WHERE status = 'published'";
  const params = [];

  if (category) {
    queryStr += " AND category = ?";
    params.push(category);
  }

  if (tag) {
    queryStr += " AND id IN (SELECT blog_id FROM blog_tags WHERE tag = ?)";
    params.push(tag);
  }

  if (search) {
    queryStr += " AND (title LIKE ? OR excerpt LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  // Get total count for pagination UI in Blog.jsx
  const countResult = await c.env.DB.prepare(`SELECT COUNT(*) as total ${queryStr}`).bind(...params).first();
  const total = countResult.total;

  // Get paginated results
  const { results } = await c.env.DB.prepare(`
    SELECT * ${queryStr} 
    ORDER BY published_at DESC 
    LIMIT ? OFFSET ?
  `).bind(...params, parseInt(limit), offset).all();

  return sendSuccess(c, 200, {
    posts: results,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit)
    }
  });
};

export const getPostBySlug = async (c) => {
  const identifier = c.req.param('slug') || c.req.param('id'); 
  
  if (!identifier) return sendError(c, 400, "Identifier is required");

  // Determine if we are looking up by ID or Slug
  const isUuid = identifier.length === 36; 
  const queryField = isUuid ? "b.id" : "b.slug";

  const post = await c.env.DB.prepare(`
    SELECT b.*, u.fullName as authorName 
    FROM blogs b 
    JOIN users u ON b.author_id = u.id 
    WHERE ${queryField} = ?
  `).bind(identifier).first(); // Now identifier is never undefined

  if (!post) return sendError(c, 404, "Post not found");

  if (!isUuid) {
    await c.env.DB.prepare(`
      UPDATE blogs SET views = views + 1 WHERE id = ?
    `).bind(post.id).run();
    post.views += 1; 
  }

  // Fetch tags for this post
  const { results: tags } = await c.env.DB.prepare(
    "SELECT tag FROM blog_tags WHERE blog_id = ?"
  ).bind(post.id).all();

  // Fetch related posts (same category, excluding current)
  const { results: relatedPosts } = await c.env.DB.prepare(`
    SELECT id, title, slug, excerpt, cover_image, published_at, reading_time 
    FROM blogs 
    WHERE category = ? AND id != ? AND status = 'published'
    LIMIT 3
  `).bind(post.category, post.id).all();

  return sendSuccess(c, 200, {
    ...post,
    tags: tags.map(t => t.tag),
    relatedPosts
  });
};

export const getCategories = async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT category as id, COUNT(*) as count 
      FROM blogs 
      WHERE status = 'published' 
      GROUP BY category 
      ORDER BY count DESC
    `).all();

    return sendSuccess(c, 200, results, "Categories fetched successfully");
  } catch (error) {
    return sendError(c, 500, "Failed to fetch categories: " + error.message);
  }
};

export const getTags = async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT tag as id, COUNT(*) as count 
      FROM blog_tags 
      GROUP BY tag 
      ORDER BY count DESC
    `).all();

    return sendSuccess(c, 200, results, "Tags fetched successfully");
  } catch (error) {
    return sendError(c, 500, "Failed to fetch tags: " + error.message);
  }
};

// --- ADMIN ENDPOINTS ---

export const getBlogStats = async (c) => {
  try {
    // 1. Get Status Stats (e.g., { published: 3, draft: 1 })
    const statusQuery = c.env.DB.prepare(`
      SELECT status, COUNT(*) as count 
      FROM blogs 
      GROUP BY status
    `).all();

    // 2. Get Category Stats (Matching your specific Array format)
    const categoryQuery = c.env.DB.prepare(`
      SELECT category as _id, COUNT(*) as count 
      FROM blogs 
      WHERE status = 'published' 
      GROUP BY category 
      ORDER BY count DESC
    `).all();

    // 3. Get Total Views and Total Count
    const totalsQuery = c.env.DB.prepare(`
      SELECT SUM(views) as totalViews, COUNT(*) as total 
      FROM blogs
    `).first();

    // Execute all queries in parallel
    const [statusRes, categoryRes, totalsRes] = await Promise.all([
      statusQuery,
      categoryQuery,
      totalsQuery
    ]);

    // Format the status results into a key-value object
    const byStatus = statusRes.results.reduce((acc, row) => {
      acc[row.status] = row.count;
      return acc;
    }, {});

    const statsData = {
      byStatus,
      byCategory: categoryRes.results,
      totalViews: totalsRes.totalViews || 0,
      total: totalsRes.total || 0
    };

    return sendSuccess(c, 200, statsData, "Blog stats fetched");
  } catch (error) {
    return sendError(c, 500, "Failed to fetch stats: " + error.message);
  }
};

export const getAllPostsAdmin = async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, title, slug, status, category, views, created_at FROM blogs ORDER BY created_at DESC"
  ).all();
  return sendSuccess(c, 200, results);
};

export const createPost = async (c) => {
  const data = await c.req.json();
  const user = c.get('user');
  const id = generateId();

  const queries = [
    await c.env.DB.prepare(`
      INSERT INTO blogs (
        id, title, slug, excerpt, content, cover_image, 
        category, author_id, status, published_at, 
        reading_time, meta_title, meta_description, related_tool
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      data.title,
      data.slug,
      data.excerpt,
      data.content,
      data.coverImage,
      data.category,
      user.id,
      data.status || 'draft',
      data.status === 'published' ? new Date().toISOString() : null,
      data.readingTime || 1,
      data.metaTitle,
      data.metaDescription,
      data.relatedTool,
    )
  ];

  if (data.tags && data.tags.length > 0) {
    await data.tags.forEach(tag => {
      queries.push(
        c.env.DB.prepare("INSERT INTO blog_tags (blog_id, tag) VALUES (?, ?)")
          .bind(id, tag)
      );
    });
  }

  try {
    await c.env.DB.batch(queries);
    return sendSuccess(c, 201, { id }, "Post created successfully");
  } catch (error) {
    return sendError(c, 500, "Database error: " + error.message);
  }
};

export const updatePost = async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();
  
  // Standard update logic... 
  // (In production, you'd check if the post exists first)
  await c.env.DB.prepare(`
    UPDATE blogs SET title = ?, excerpt = ?, content = ?, cover_image = ?, status = ?, category = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(data.title, data.excerpt, data.content, data.coverImage, data.status, data.category, id).run();

  return sendSuccess(c, 200, {}, "Post updated");
};

export const deletePost = async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare("DELETE FROM blogs WHERE id = ?").bind(id).run();
  return sendSuccess(c, 200, {}, "Post deleted");
};
