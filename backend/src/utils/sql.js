const mapRow = (columns, row) => {
  const result = {};
  columns.forEach((column, index) => {
    result[column] = row[index];
  });
  return result;
};

const getRows = (db, query, params = []) => {
  const result = db.exec(query, params);

  if (result.length === 0 || result[0].values.length === 0) {
    return [];
  }

  const { columns, values } = result[0];
  return values.map((row) => mapRow(columns, row));
};

const getRow = (db, query, params = []) => {
  const rows = getRows(db, query, params);
  return rows[0] || null;
};

module.exports = {
  mapRow,
  getRow,
  getRows
};
