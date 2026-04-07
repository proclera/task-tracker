const normalizePlaceholders = (query) => {
  let index = 0;
  return query.replace(/\?/g, () => `$${++index}`);
};

const getRows = async (db, query, params = []) => {
  const result = await db.query(query, params);
  return result.rows;
};

const getRow = async (db, query, params = []) => {
  const rows = await getRows(db, query, params);
  return rows[0] || null;
};

module.exports = {
  normalizePlaceholders,
  getRow,
  getRows
};
