import createDOMPurify from 'dompurify';
import { defaultOptions, renderAsync, type HElement } from 'docx-preview';
import { assertDocxBudget } from './preview.ts';

function safeCss(value: string) {
  // “>” selectors and escaped list counters are ordinary Word formatting.
  // Reject HTML delimiters and explicit resource loads; CSP independently
  // blocks all external CSS/fonts/images, including escaped CSS URL tricks.
  return /url\s*\(|@import|expression|</i.test(value) ? '' : value;
}

function previewNode(element: HElement | Node | string): Node {
  // Some DOM implementations omit MathMLElement.style. Preserve mathematical
  // layout via a style attribute rather than assuming it is a CSS declaration.
  if (typeof element !== 'string' && !(element instanceof Node) && element.ns === 'http://www.w3.org/1998/Math/MathML' && element.style) {
    const node = defaultOptions.h({ ...element, style: undefined }) as Element;
    const css = typeof element.style === 'string' ? element.style : Object.entries(element.style)
      .map(([key,value]) => key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase()) + ':' + value).join(';');
    node.setAttribute('style', safeCss(css));
    return node;
  }
  return defaultOptions.h(element);
}

export function cleanDocumentHtml(body: string, style: string, windowContext = window) {
  const purifier = createDOMPurify(windowContext);
  purifier.addHook('uponSanitizeAttribute', (_node, attribute) => {
    if (attribute.attrName === 'style') attribute.attrValue = safeCss(attribute.attrValue);
  });
  const content = purifier.sanitize(body, {
    USE_PROFILES: { html: true, mathMl: true },
    FORBID_TAGS: ['style','script','iframe','object','embed','form','input','button','link','meta','base'],
    FORBID_ATTR: ['href','srcset','target','action','formaction','xlink:href'],
    ALLOWED_URI_REGEXP: /^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i,
    ALLOW_DATA_ATTR: false,
  });
  // No scripts or external requests inside the document. It never gets injected
  // into the application's DOM, and original Word HTML chunks are disabled.
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'; font-src \'none\'; base-uri \'none\'; form-action \'none\'; frame-src \'none\'">'
    + '<style>' + safeCss(style) + '\nhtml{color-scheme:light}body{margin:0;background:#e9e8e4;color:#151515}a{color:inherit;text-decoration:none}'
    + '.docx-wrapper{padding:24px 16px!important;background:transparent!important}.docx-wrapper>section.docx{margin:0 auto 24px;box-shadow:0 2px 12px #00000015}'
    // Word already supplies image extents and crop transforms. object-fit:contain
    // letterboxes that source box before cropping and can cut away the diagram.
    + 'img{max-width:100%}math{font-family:"Cambria Math","STIX Two Math",serif}'
    // Keep the downloaded document untouched, but reflow its reading preview on
    // phones instead of making every line require horizontal panning.
    + '@media(max-width:700px){.docx-wrapper{padding:12px 8px!important}'
    + '.docx-wrapper>section.docx{width:100%!important;min-width:0;min-height:0!important;padding:28px 20px!important;box-sizing:border-box}'
    + 'section.docx>article{min-height:0!important}section.docx p{margin-inline:0!important;text-indent:0!important}'
    + 'section.docx table{width:100%!important;max-width:100%!important;table-layout:fixed}section.docx col{width:auto!important}'
    + 'section.docx td,section.docx th{width:auto!important;min-width:0;overflow-wrap:anywhere}'
    + 'section.docx div{max-width:100%}section.docx img:not([style*="transform"]){height:auto!important}}'
    + '</style></head><body>' + content + '</body></html>';
}

export async function renderDocxPreview(bytes: ArrayBuffer, signal: AbortSignal) {
  assertDocxBudget(bytes);
  signal.throwIfAborted();
  const body = document.createElement('div'), styles = document.createElement('div');
  await renderAsync(bytes, body, styles, {
    useBase64URL: true, ignoreFonts: true, renderAltChunks: false,
    renderComments: false, experimental: false, ignoreLastRenderedPageBreak: false,
    h: previewNode,
  });
  signal.throwIfAborted();
  if (body.innerHTML.length > 8 * 1024 * 1024) throw new Error('Preview too large');
  return cleanDocumentHtml(body.innerHTML, [...styles.querySelectorAll('style')].map(element => element.textContent).join('\n'));
}
