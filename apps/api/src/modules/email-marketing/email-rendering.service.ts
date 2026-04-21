import { Injectable } from '@nestjs/common';

export type BlockType = 'text' | 'heading' | 'image' | 'button' | 'divider' | 'spacer' | 'product' | 'columns';

export interface Block {
  id?: string;
  type: BlockType;
  // common
  align?: 'left' | 'center' | 'right';
  backgroundColor?: string;
  padding?: number;
  // text/heading
  content?: string;           // HTML or text
  level?: 1 | 2 | 3;
  fontSize?: number;
  color?: string;
  // image
  src?: string;
  alt?: string;
  width?: number;
  link?: string;
  // button
  label?: string;
  href?: string;
  buttonColor?: string;
  textColor?: string;
  // spacer
  height?: number;
  // product
  productId?: string;
  variantId?: string;
  title?: string;
  price?: string;
  imageUrl?: string;
  productHref?: string;
  // columns
  columns?: Block[][];
}

export interface RenderContext {
  contact: {
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    tags?: string[];
  };
  shop?: { name?: string | null; domain?: string | null };
  unsubscribeUrl?: string;
  preheader?: string;
  fromName?: string;
  footerHtml?: string;
  extra?: Record<string, any>;
}

const DEFAULT_FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;

@Injectable()
export class EmailRenderingService {
  /**
   * Renders an email template (blocks + subject) into a full HTML document
   * ready to send, plus a plaintext fallback.
   */
  render(params: {
    subject: string;
    preheader?: string;
    blocks: Block[] | any;
    htmlOverride?: string | null;
    context: RenderContext;
  }): { subject: string; html: string; text: string } {
    const subject = this.substituteVars(params.subject, params.context);
    const preheader = params.preheader ? this.substituteVars(params.preheader, params.context) : '';

    let bodyHtml: string;
    if (params.htmlOverride && params.htmlOverride.trim()) {
      bodyHtml = this.substituteVars(params.htmlOverride, params.context);
    } else {
      const blocks: Block[] = Array.isArray(params.blocks) ? params.blocks : (params.blocks?.blocks || []);
      bodyHtml = blocks.map((b) => this.renderBlock(b, params.context)).join('\n');
    }

    const html = this.wrapDocument(bodyHtml, {
      subject, preheader, context: params.context,
    });

    const text = this.toPlainText(html);

    return { subject, html, text };
  }

  // ---------------- Variable substitution ----------------

  /**
   * Simple {{var}} substitution. Supports nested paths: {{contact.firstName}}.
   * Unknown vars are silently replaced with empty string.
   */
  substituteVars(template: string, ctx: RenderContext): string {
    if (!template) return '';
    return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
      const flat = this.flatten(ctx);
      const val = flat[path] ?? flat[path.toLowerCase()];
      if (val === undefined || val === null) return '';
      return String(val);
    });
  }

  private flatten(ctx: RenderContext): Record<string, any> {
    const out: Record<string, any> = {};
    const walk = (obj: any, prefix: string) => {
      if (obj == null || typeof obj !== 'object') return;
      for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}.${k}` : k;
        if (v != null && typeof v === 'object' && !Array.isArray(v)) {
          walk(v, key);
        } else {
          out[key] = v;
        }
      }
    };
    walk(ctx, '');
    // Common aliases
    out['first_name'] = ctx.contact?.firstName ?? '';
    out['last_name'] = ctx.contact?.lastName ?? '';
    out['email'] = ctx.contact?.email ?? '';
    out['shop_name'] = ctx.shop?.name ?? '';
    out['unsubscribe_url'] = ctx.unsubscribeUrl ?? '';
    return out;
  }

  // ---------------- Block rendering ----------------

  private renderBlock(block: Block, ctx: RenderContext): string {
    const pad = block.padding ?? 20;
    const align = block.align ?? 'left';
    const bg = block.backgroundColor ?? '';
    const outerStyle = `padding:${pad}px;${bg ? `background-color:${bg};` : ''}`;

    switch (block.type) {
      case 'text': {
        const content = this.substituteVars(block.content || '', ctx);
        return `<tr><td style="${outerStyle}text-align:${align};font-family:${DEFAULT_FONT};font-size:${block.fontSize || 15}px;color:${block.color || '#1f2937'};line-height:1.6;">${content}</td></tr>`;
      }
      case 'heading': {
        const content = this.substituteVars(block.content || '', ctx);
        const tag = `h${block.level || 2}`;
        const size = block.fontSize || (block.level === 1 ? 28 : block.level === 3 ? 18 : 22);
        return `<tr><td style="${outerStyle}text-align:${align};font-family:${DEFAULT_FONT};">
  <${tag} style="margin:0;font-size:${size}px;font-weight:700;color:${block.color || '#111827'};">${this.escapeHtml(content)}</${tag}>
</td></tr>`;
      }
      case 'image': {
        if (!block.src) return '';
        const width = block.width || 600;
        const img = `<img src="${this.attrEscape(block.src)}" alt="${this.attrEscape(block.alt || '')}" width="${width}" style="display:block;max-width:100%;height:auto;border:0;outline:none;" />`;
        const wrapped = block.link ? `<a href="${this.attrEscape(this.substituteVars(block.link, ctx))}">${img}</a>` : img;
        return `<tr><td style="${outerStyle}text-align:${align};">${wrapped}</td></tr>`;
      }
      case 'button': {
        const label = this.substituteVars(block.label || 'Click', ctx);
        const href = this.substituteVars(block.href || '#', ctx);
        const bgColor = block.buttonColor || '#2563eb';
        const textColor = block.textColor || '#ffffff';
        return `<tr><td style="${outerStyle}text-align:${align};font-family:${DEFAULT_FONT};">
  <a href="${this.attrEscape(href)}" style="display:inline-block;background-color:${bgColor};color:${textColor};padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">${this.escapeHtml(label)}</a>
</td></tr>`;
      }
      case 'divider':
        return `<tr><td style="${outerStyle}"><hr style="border:0;border-top:1px solid ${block.color || '#e5e7eb'};margin:0;" /></td></tr>`;
      case 'spacer':
        return `<tr><td style="line-height:${block.height || 24}px;height:${block.height || 24}px;">&nbsp;</td></tr>`;
      case 'product': {
        const title = block.title || '';
        const price = block.price || '';
        const href = block.productHref || '#';
        const img = block.imageUrl || '';
        return `<tr><td style="${outerStyle}">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="font-family:${DEFAULT_FONT};">
    <tr>
      ${img ? `<td width="140" valign="top" style="padding-right:16px;"><a href="${this.attrEscape(href)}"><img src="${this.attrEscape(img)}" alt="${this.attrEscape(title)}" width="140" style="display:block;max-width:140px;border-radius:8px;" /></a></td>` : ''}
      <td valign="top">
        <a href="${this.attrEscape(href)}" style="color:#111827;font-weight:600;font-size:15px;text-decoration:none;">${this.escapeHtml(title)}</a>
        <div style="color:#6b7280;font-size:14px;margin-top:4px;">${this.escapeHtml(price)}</div>
      </td>
    </tr>
  </table>
</td></tr>`;
      }
      case 'columns': {
        const cols = block.columns || [];
        const colWidth = Math.floor(100 / Math.max(1, cols.length));
        const inner = cols.map(
          (colBlocks) => `<td valign="top" width="${colWidth}%" style="padding:8px;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    ${colBlocks.map((b) => this.renderBlock(b, ctx)).join('\n')}
  </table>
</td>`
        ).join('\n');
        return `<tr><td style="${outerStyle}"><table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>${inner}</tr></table></td></tr>`;
      }
      default:
        return '';
    }
  }

  private wrapDocument(body: string, opts: { subject: string; preheader?: string; context: RenderContext }): string {
    const footer = opts.context.footerHtml || `
  <div style="padding:20px;text-align:center;color:#9ca3af;font-size:12px;font-family:${DEFAULT_FONT};">
    <p style="margin:0 0 8px 0;">Du erhältst diese E-Mail als eingetragener Empfänger${opts.context.shop?.name ? ` von ${this.escapeHtml(opts.context.shop.name)}` : ''}.</p>
    <p style="margin:0;">
      <a href="${this.attrEscape(opts.context.unsubscribeUrl || '#')}" style="color:#6b7280;text-decoration:underline;">Abmelden</a>
    </p>
  </div>`;

    return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${this.escapeHtml(opts.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;">
${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;color:transparent;">${this.escapeHtml(opts.preheader)}</div>` : ''}
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f3f4f6;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        ${body}
      </table>
      ${footer}
    </td>
  </tr>
</table>
</body>
</html>`;
  }

  // ---------------- Utilities ----------------

  private toPlainText(html: string): string {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private escapeHtml(s: string): string {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  private attrEscape(s: string): string {
    return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * Inject tracking pixel + rewrite links for click tracking.
   * Called by the sender after rendering but before sending.
   */
  addTracking(
    html: string,
    opts: {
      pixelUrl: string;
      clickUrlBuilder: (originalUrl: string) => string;
    },
  ): string {
    // Rewrite all <a href="..."> except unsubscribe + mailto
    let out = html.replace(/<a\s+([^>]*?)href="([^"]+)"/gi, (match, attrs: string, url: string) => {
      // Skip unsubscribe + mailto + anchors
      if (/unsubscribe|^mailto:|^#/i.test(url)) return match;
      const tracked = opts.clickUrlBuilder(url);
      return `<a ${attrs}href="${this.attrEscape(tracked)}"`;
    });
    // Insert pixel just before </body>
    const pixel = `<img src="${this.attrEscape(opts.pixelUrl)}" width="1" height="1" alt="" style="display:none;" />`;
    if (/<\/body>/i.test(out)) {
      out = out.replace(/<\/body>/i, `${pixel}</body>`);
    } else {
      out = out + pixel;
    }
    return out;
  }
}
