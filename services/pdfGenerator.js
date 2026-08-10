const PDFDocument = require('pdfkit');

const PAGE_MARGIN = 50;
const COLORS = {
  text: '#111827',
  muted: '#4B5563',
  border: '#E5E7EB',
};

const SECTION_LABELS = {
  summary: 'Professional Summary',
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  projects: 'Projects',
  certificates: 'Certificates',
  languages: 'Languages',
  references: 'References',
  custom: 'Additional Information',
};

const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

const drawSectionHeading = (doc, text, accentColor) => {
  doc.moveDown(0.5);
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(accentColor)
    .text(text.toUpperCase(), { characterSpacing: 0.5 });
  const y = doc.y + 2;
  doc
    .moveTo(PAGE_MARGIN, y)
    .lineTo(doc.page.width - PAGE_MARGIN, y)
    .lineWidth(1)
    .strokeColor(COLORS.border)
    .stroke();
  doc.moveDown(0.6);
  doc.fillColor(COLORS.text).font('Helvetica');
};

// Renders one specific section type into the PDF document. Kept as
// separate small functions rather than one giant switch body so a new
// template can later reuse individual section renderers instead of
// duplicating this logic.
const renderers = {
  summary: (doc, resume) => {
    if (!resume.summary) return;
    doc.fontSize(10).fillColor(COLORS.text).text(resume.summary, { align: 'left' });
  },

  experience: (doc, resume, accentColor) => {
    if (!resume.experience || resume.experience.length === 0) return;
    resume.experience.forEach((exp, i) => {
      doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.text).text(exp.designation || '');
      const dateRange = `${formatDate(exp.startDate)} - ${exp.isCurrent ? 'Present' : formatDate(exp.endDate)}`;
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(COLORS.muted)
        .text(`${exp.company || ''}   |   ${dateRange}`);
      if (exp.description) {
        doc.moveDown(0.2);
        doc.fontSize(10).fillColor(COLORS.text).text(exp.description);
      }
      if (i < resume.experience.length - 1) doc.moveDown(0.5);
    });
  },

  education: (doc, resume) => {
    if (!resume.education || resume.education.length === 0) return;
    resume.education.forEach((edu, i) => {
      doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.text).text(edu.degree || '');
      const institution = [edu.college, edu.university].filter(Boolean).join(', ');
      const years = [edu.startYear, edu.endYear].filter(Boolean).join(' - ');
      const percentageStr = edu.percentage ? `   |   ${edu.percentage}` : '';
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(COLORS.muted)
        .text(`${institution}${years ? `   |   ${years}` : ''}${percentageStr}`);
      if (i < resume.education.length - 1) doc.moveDown(0.4);
    });
  },

  skills: (doc, resume) => {
    if (!resume.skills || resume.skills.length === 0) return;
    doc.fontSize(10).fillColor(COLORS.text).text(resume.skills.join('  •  '));
  },

  projects: (doc, resume) => {
    if (!resume.projects || resume.projects.length === 0) return;
    resume.projects.forEach((proj, i) => {
      doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.text).text(proj.title || '');
      if (proj.technology) {
        doc.font('Helvetica').fontSize(10).fillColor(COLORS.muted).text(proj.technology);
      }
      if (proj.description) {
        doc.moveDown(0.15);
        doc.fontSize(10).fillColor(COLORS.text).text(proj.description);
      }
      const links = [proj.github, proj.liveUrl].filter(Boolean).join('   |   ');
      if (links) {
        doc.moveDown(0.1);
        doc.fontSize(9).fillColor(COLORS.muted).text(links);
      }
      if (i < resume.projects.length - 1) doc.moveDown(0.5);
    });
  },

  certificates: (doc, resume) => {
    if (!resume.certificates || resume.certificates.length === 0) return;
    resume.certificates.forEach((cert) => {
      const line = [cert.name, cert.issuer, formatDate(cert.date)].filter(Boolean).join('  |  ');
      doc.fontSize(10).fillColor(COLORS.text).text(line);
    });
  },

  languages: (doc, resume) => {
    if (!resume.languages || resume.languages.length === 0) return;
    const line = resume.languages.map((l) => `${l.name} (${l.proficiency})`).join('  •  ');
    doc.fontSize(10).fillColor(COLORS.text).text(line);
  },

  references: (doc, resume) => {
    if (!resume.references || resume.references.length === 0) return;
    resume.references.forEach((ref) => {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.text).text(ref.name || '');
      const line = [ref.position, ref.company].filter(Boolean).join(', ');
      const contact = [ref.email, ref.phone].filter(Boolean).join('  |  ');
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted).text([line, contact].filter(Boolean).join('   —   '));
    });
  },

  custom: (doc, resume) => {
    if (!resume.customSections || resume.customSections.length === 0) return;
    resume.customSections.forEach((section) => {
      doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.text).text(section.heading || '');
      doc.moveDown(0.2);
      (section.items || []).forEach((item) => {
        const titleLine = [item.title, item.date].filter(Boolean).join('   |   ');
        if (titleLine) doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.text).text(titleLine);
        if (item.subtitle) doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted).text(item.subtitle);
        if (item.description) doc.fontSize(10).fillColor(COLORS.text).text(item.description);
        doc.moveDown(0.3);
      });
    });
  },
};

// Predicate for whether a section actually has renderable content -
// checked BEFORE drawing anything. This matters because pdfkit draws
// text immediately as each call happens; there's no way to "undraw" a
// heading after the fact once it's on the page, so empty sections must
// be detected up front, not cleaned up after rendering.
const hasContent = {
  summary: (resume) => !!resume.summary,
  experience: (resume) => Array.isArray(resume.experience) && resume.experience.length > 0,
  education: (resume) => Array.isArray(resume.education) && resume.education.length > 0,
  skills: (resume) => Array.isArray(resume.skills) && resume.skills.length > 0,
  projects: (resume) => Array.isArray(resume.projects) && resume.projects.length > 0,
  certificates: (resume) => Array.isArray(resume.certificates) && resume.certificates.length > 0,
  languages: (resume) => Array.isArray(resume.languages) && resume.languages.length > 0,
  references: (resume) => Array.isArray(resume.references) && resume.references.length > 0,
  custom: (resume) => Array.isArray(resume.customSections) && resume.customSections.length > 0,
};

// Builds a complete PDF buffer for a given Resume document. Returns a
// Promise since pdfkit streams output asynchronously via events.
const generateResumePdf = (resume) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const accentColor = resume.themeColor || '#2563EB';
      const pd = resume.personalDetails || {};

      // Header block
      doc.font('Helvetica-Bold').fontSize(22).fillColor(COLORS.text).text(pd.fullName || 'Untitled');
      if (pd.headline) {
        doc.font('Helvetica').fontSize(12).fillColor(accentColor).text(pd.headline);
      }
      doc.moveDown(0.3);

      const contactLine = [pd.email, pd.phone, pd.location].filter(Boolean).join('   |   ');
      if (contactLine) {
        doc.fontSize(9.5).fillColor(COLORS.muted).text(contactLine);
      }
      const linksLine = [pd.linkedin, pd.github, pd.portfolio].filter(Boolean).join('   |   ');
      if (linksLine) {
        doc.fontSize(9.5).fillColor(COLORS.muted).text(linksLine);
      }

      doc.moveDown(0.3);
      doc
        .moveTo(PAGE_MARGIN, doc.y)
        .lineTo(doc.page.width - PAGE_MARGIN, doc.y)
        .lineWidth(1.5)
        .strokeColor(accentColor)
        .stroke();

      // Render sections in the resume's configured order, skipping any
      // the user has hidden and any with no renderer available.
      const order = resume.sectionOrder && resume.sectionOrder.length ? resume.sectionOrder : Object.keys(SECTION_LABELS);
      const hidden = new Set(resume.hiddenSections || []);

      order.forEach((sectionKey) => {
        if (hidden.has(sectionKey)) return;
        const renderFn = renderers[sectionKey];
        const checkFn = hasContent[sectionKey];
        if (!renderFn || !checkFn) return;
        if (!checkFn(resume)) return; // never draw a heading for an empty section

        drawSectionHeading(doc, SECTION_LABELS[sectionKey] || sectionKey, accentColor);
        renderFn(doc, resume, accentColor);
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = { generateResumePdf };
