// Conversor de Markdown para formatação do WhatsApp
// Mantém a estrutura de markdown enquanto adapta a sintaxe para WhatsApp

function detectMarkdown(text) {
  if (!text || typeof text !== 'string') return false;
  const markers = [
    /\*\*/,                 // bold markdown
    /^#{1,6}\s/m,           // headings
    /\[.*?\]\(.*?\)/,     // links
    /!\[.*?\]\(.*?\)/,    // images
    /\n\s*[-*]\s+/,        // unordered list
    /\n\s*\d+\.\s+/,      // ordered list
    /~~.*?~~/,               // strikethrough
    /```[\s\S]*?```/,      // code block
    />\s+/,                  // blockquote
  ];
  return markers.some((re) => re.test(text));
}

function convertHeadings(md) {
  return md.replace(/^#{1,6}\s+(.*)$/gm, (_, title) => `*${title.trim()}*`);
}

function convertBold(md) {
  // bold-italic ***text*** -> *_text_*
  md = md.replace(/\*\*\*([\s\S]+?)\*\*\*/g, '*_$1_*');
  // bold **text** -> *text*
  md = md.replace(/\*\*([\s\S]+?)\*\*/g, '*$1*');
  return md;
}

function convertItalic(md) {
  // italic with underscores _text_ stays as WhatsApp italic
  // italic with single asterisks *text* (not part of ** or ***) -> _text_
  md = md.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, (m, pre, content) => `${pre}_${content}_`);
  return md;
}

function convertStrikethrough(md) {
  // markdown ~~text~~ -> WhatsApp ~text~
  return md.replace(/~~([\s\S]+?)~~/g, '~$1~');
}

function convertLinks(md) {
  // [text](url) -> text (url)
  md = md.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '$1 ($2)');
  // images ![alt](url) -> alt (url)
  md = md.replace(/!\[([^\]]*)\]\(([^\)]+)\)/g, '$1 ($2)');
  return md;
}

function convertLists(md) {
  // unordered lists - item / * item -> • item
  md = md.replace(/^(\s*)[-*]\s+(.*)$/gm, (_, indent, item) => `${indent}• ${item}`);
  // ordered lists keep as is
  return md;
}

function convertBlockquotes(md) {
  // > quote -> ❯ quote
  return md.replace(/^>\s+(.*)$/gm, '❯ $1');
}

function convertCode(md) {
  // code blocks ```lang\n...``` -> ```\n...```
  md = md.replace(/```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g, (m, _lang, code) => `\n\`\`\`\n${code.trim()}\n\`\`\`\n`);
  // inline code `code` -> ```code```
  md = md.replace(/`([^`]+)`/g, '```$1```');
  return md;
}

function convertHr(md) {
  // --- or *** -> — — —
  return md.replace(/\n\s*(?:-{3,}|\*{3,})\s*\n/g, '\n— — —\n');
}

function normalizeSpacing(md) {
  // ensure consistent newlines around code blocks
  return md.replace(/\n{3,}/g, '\n\n');
}

function mdToWhatsapp(text) {
  const input = typeof text === 'string' ? text : String(text || '');
  if (!detectMarkdown(input)) return input; // nothing to convert

  let out = input;
  out = convertHeadings(out);
  out = convertBold(out);
  out = convertItalic(out);
  out = convertStrikethrough(out);
  out = convertLinks(out);
  out = convertLists(out);
  out = convertBlockquotes(out);
  out = convertCode(out);
  out = convertHr(out);
  out = normalizeSpacing(out);
  return out;
}

module.exports = { mdToWhatsapp, detectMarkdown };