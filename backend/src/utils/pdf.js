const escapePdfText = (value) => String(value)
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)');

const buildPageContent = (lines) => {
  const text = lines.map((line) => `(${escapePdfText(line)}) Tj`).join(' T* ');
  return `BT
/F1 10 Tf
50 790 Td
14 TL
${text}
ET`;
};

const paginateLines = (lines, linesPerPage = 48) => {
  const pages = [];

  for (let index = 0; index < lines.length; index += linesPerPage) {
    pages.push(lines.slice(index, index + linesPerPage));
  }

  return pages.length ? pages : [['No data available']];
};

const buildPdfBuffer = (pages) => {
  const objects = [];
  const pageObjectNumbers = [];
  const contentObjectNumbers = [];

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = '';

  let objectNumber = 3;

  pages.forEach((pageLines) => {
    const pageNumber = objectNumber++;
    const contentNumber = objectNumber++;
    pageObjectNumbers.push(pageNumber);
    contentObjectNumbers.push(contentNumber);

    const content = buildPageContent(pageLines);
    objects[pageNumber] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${objectNumber} 0 R >> >> /Contents ${contentNumber} 0 R >>`;
    objects[contentNumber] = `<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`;
  });

  const fontObjectNumber = objectNumber;
  objects[fontObjectNumber] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>';
  objects[2] = `<< /Type /Pages /Count ${pageObjectNumbers.length} /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(' ')}] >>`;

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = Buffer.byteLength(pdf, 'utf8');
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += '0000000000 65535 f \n';

  for (let index = 1; index < objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
};

const createSimplePdf = (lines) => buildPdfBuffer(paginateLines(lines));

module.exports = {
  createSimplePdf
};
