import Handlebars from 'handlebars';

export function renderTemplate(template, data) {
  const compiled = Handlebars.compile(template);
  return compiled(data);
}

