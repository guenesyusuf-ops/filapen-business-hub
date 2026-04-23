import {
  Controller, Get, Post, Put, Delete, Param, Body, Headers, Query,
  UploadedFile, UseInterceptors, BadRequestException, Res, StreamableFile, Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { extractAuthContext, assertCanWrite } from './auth-context';
import { SalesCustomerService } from './sales-customer.service';
import { SalesOrderService } from './sales-order.service';
import { SalesDocumentService } from './sales-document.service';
import { SalesImportService } from './sales-import.service';
import { EasybillService } from './easybill.service';

@Controller('sales')
export class SalesController {
  private readonly logger = new Logger(SalesController.name);
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
    private readonly customers: SalesCustomerService,
    private readonly orders: SalesOrderService,
    private readonly documents: SalesDocumentService,
    private readonly importer: SalesImportService,
    private readonly easybill: EasybillService,
  ) {}

  // ==========================================================
  // Dashboard
  // ==========================================================
  @Get('dashboard')
  async dashboard(@Headers('authorization') authHeader: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.orders.dashboard(orgId);
  }

  // ==========================================================
  // Customers
  // ==========================================================
  @Get('customers')
  async listCustomers(
    @Headers('authorization') authHeader: string,
    @Query() q: { search?: string; limit?: string; offset?: string },
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.customers.list(orgId, {
      search: q.search,
      limit: q.limit ? parseInt(q.limit, 10) : undefined,
      offset: q.offset ? parseInt(q.offset, 10) : undefined,
    });
  }

  @Get('customers/:id')
  async getCustomer(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.customers.get(orgId, id);
  }

  @Post('customers')
  async createCustomer(@Headers('authorization') authHeader: string, @Body() body: any) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.customers.create(orgId, body);
  }

  @Put('customers/:id')
  async updateCustomer(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.customers.update(orgId, id, body);
  }

  @Delete('customers/:id')
  async deleteCustomer(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.customers.remove(orgId, id);
  }

  // ==========================================================
  // Orders
  // ==========================================================
  @Get('orders')
  async listOrders(
    @Headers('authorization') authHeader: string,
    @Query() q: { status?: string; customerId?: string; search?: string; urgency?: 'urgent' | 'overdue'; limit?: string; offset?: string },
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.orders.list(orgId, {
      status: q.status,
      customerId: q.customerId,
      search: q.search,
      urgency: q.urgency,
      limit: q.limit ? parseInt(q.limit, 10) : undefined,
      offset: q.offset ? parseInt(q.offset, 10) : undefined,
    });
  }

  @Get('orders/:id')
  async getOrder(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.orders.get(orgId, id);
  }

  @Post('orders')
  async createOrder(@Headers('authorization') authHeader: string, @Body() body: any) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.orders.create(orgId, userId, body);
  }

  @Put('orders/:id')
  async updateOrder(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.orders.update(orgId, userId, id, body);
  }

  @Put('orders/:id/line-items')
  async replaceLineItems(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: { items: any[] },
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.orders.replaceLineItems(orgId, userId, id, body.items ?? []);
  }

  @Delete('orders/:id')
  async deleteOrder(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.orders.remove(orgId, id);
  }

  // Status toggles (three badges)
  @Post('orders/:id/status/confirmation-sent')
  async toggleConfirmation(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: { on?: boolean },
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.orders.toggleStatus(orgId, userId, id, 'confirmation_sent', body.on ?? true);
  }

  @Post('orders/:id/status/shipped')
  async toggleShipped(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: { on?: boolean },
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.orders.toggleStatus(orgId, userId, id, 'shipped', body.on ?? true);
  }

  @Post('orders/:id/status/invoice-sent')
  async toggleInvoice(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: { on?: boolean },
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.orders.toggleStatus(orgId, userId, id, 'invoice_sent', body.on ?? true);
  }

  @Post('orders/:id/status/paid')
  async togglePaid(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: { on?: boolean },
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.orders.toggleStatus(orgId, userId, id, 'paid', body.on ?? true);
  }

  @Put('orders/:id/shipping')
  async updateShipping(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.orders.updateShipping(orgId, userId, id, body);
  }

  // ==========================================================
  // Documents
  // ==========================================================
  @Get('orders/:id/documents')
  async listDocs(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.documents.list(orgId, id);
  }

  @Post('orders/:id/documents')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async uploadDoc(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @UploadedFile() file: any,
    @Body('kind') kind: 'original' | 'confirmation' | 'invoice' | 'other',
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    if (!file) throw new BadRequestException('Datei fehlt');
    return this.documents.attach(orgId, userId, id, file, kind || 'other');
  }

  @Delete('orders/:id/documents/:docId')
  async deleteDoc(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Param('docId') docId: string,
  ) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.documents.remove(orgId, id, docId);
  }

  // ==========================================================
  // Import (PDF/Bild → Claude Vision → Preview)
  // ==========================================================
  @Post('orders/import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async importOrder(
    @Headers('authorization') authHeader: string,
    @UploadedFile() file: any,
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    if (!file) throw new BadRequestException('Datei fehlt');
    return this.importer.runImport(orgId, userId, file);
  }

  /**
   * Confirm the import: persist the (possibly-edited) extracted data as a
   * new SalesOrder, plus attach the original file as SalesOrderDocument.
   *
   * Body: {
   *   customerId: string (already existing) | null,
   *   newCustomer: {...} (used when customerId is null),
   *   extracted: ExtractedOrder,
   *   sourceDocumentId: string  (opaque handle from /import response)
   * }
   */
  @Post('orders/import/confirm')
  async confirmImport(
    @Headers('authorization') authHeader: string,
    @Body() body: any,
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);

    // Resolve customer — reuse or create
    let customerId = body.customerId;
    if (!customerId && body.newCustomer) {
      const created = await this.customers.create(orgId, body.newCustomer);
      customerId = created.id;
    }
    if (!customerId) throw new BadRequestException('customerId oder newCustomer erforderlich');

    const ex = body.extracted || {};
    const handle = body.sourceDocumentId ? this.importer.decodeSourceHandle(body.sourceDocumentId) : null;

    const order = await this.orders.create(orgId, userId, {
      customerId,
      externalOrderNumber: ex.externalOrderNumber ?? null,
      orderDate: ex.orderDate ?? null,
      requiredDeliveryDate: ex.requiredDeliveryDate ?? null,
      contactPerson: ex.contactPerson ?? null,
      shippingAddress: ex.shippingAddress ?? null,
      billingAddress: ex.billingAddress ?? null,
      paymentTerms: ex.paymentTerms ?? null,
      currency: ex.currency ?? 'EUR',
      lineItems: (ex.lineItems ?? []).map((l: any) => ({
        title: l.title || 'Artikel',
        supplierArticleNumber: l.supplierArticleNumber ?? null,
        ean: l.ean ?? null,
        unitsPerCarton: l.unitsPerCarton ?? null,
        quantity: Number(l.quantity) || 1,
        unitPriceNet: Number(l.unitPriceNet) || 0,
        lineNet: l.lineNet != null ? Number(l.lineNet) : undefined,
        matchedProductVariantId: l.matchedProductVariantId ?? null,
      })),
      sourceDocumentId: null, // we'll link the doc row below once it exists
      extractionConfidence: body.confidence ?? null,
    });

    // If we have the original file handle from preview, promote it to a doc row
    if (handle) {
      try {
        await this.documents.attachBuffer(
          orgId, userId, order.id,
          // Re-fetch not needed — the file is already in R2 under handle.key.
          // But attachBuffer wants a Buffer; we don't have one locally after the
          // preview flow (it's only in R2). We fall back to creating the DB row
          // directly with the stored key/url.
          Buffer.alloc(0),
          handle.name, handle.mime, 'original',
        ).catch(async () => {
          // If attachBuffer refuses the empty buffer, insert raw row manually.
          await this.prisma.salesOrderDocument.create({
            data: {
              orgId, orderId: order.id, kind: 'original',
              fileName: handle.name, r2Key: handle.key, url: handle.url,
              mimeType: handle.mime, sizeBytes: handle.size, uploadedById: userId,
            },
          });
        });
      } catch (err: any) {
        this.logger.warn(`Attach original doc failed: ${err.message}`);
      }
    }

    return order;
  }

  // ==========================================================
  // easybill
  // ==========================================================
  @Get('easybill/status')
  async easybillStatus(@Headers('authorization') authHeader: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    try {
      const r = await this.easybill.testConnection(orgId);
      return { connected: true, sample: r.sample };
    } catch (err: any) {
      return { connected: false, error: err.message };
    }
  }

  /**
   * Diagnostic endpoint: returns the `type` values of the last 20 documents
   * in the connected easybill account, so we can see which enum string that
   * account uses for Auftragsbestätigung vs Invoice vs Offer.
   */
  @Get('easybill/document-types')
  async easybillDocumentTypes(@Headers('authorization') authHeader: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    try {
      return await this.easybill.listDocumentTypes(orgId);
    } catch (err: any) {
      return { error: err.message };
    }
  }

  @Post('orders/:id/easybill/create-confirmation')
  async createConfirmation(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.easybill.createConfirmation(orgId, userId, id);
  }

  @Post('orders/:id/easybill/send-confirmation')
  async sendConfirmation(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.easybill.sendConfirmation(orgId, userId, id);
  }

  @Post('orders/:id/easybill/create-invoice')
  async createInvoice(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.easybill.createInvoice(orgId, userId, id);
  }

  @Post('orders/:id/easybill/send-invoice')
  async sendInvoice(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.easybill.sendInvoice(orgId, userId, id);
  }
}
