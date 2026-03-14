export const sendSuccess = (c, statusCode, data, message = "Success") => {
  return c.json({ success: true, statusCode, message, data }, statusCode);
};

export const sendError = (c, statusCode, message = "Error", errors = []) => {
  return c.json({ success: false, statusCode, message, errors }, statusCode);
};