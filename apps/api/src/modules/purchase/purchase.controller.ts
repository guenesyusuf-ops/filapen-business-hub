import {
  Controller, Get, Post, Put, Patch, Delete,
  Param, Body, Query, Headers, Res,
  UploadedFile, UseInterceptors,
  Logger, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { extractAuthContext, assertCanWrite, assertCanCancel } from './auth-context';
import { SupplierService, SupplierInput } from './supplier.service';
import { PurchaseOrderService, PoInput, InvoiceInput } from './purchase-order.service';
import { PaymentService, PaymentInput } from './payment.service';
import { PurchaseDocumentService } from './purchase-document.service';
import { PurchaseExportService } from './purchase-export.service';
import { PurchaseAuditService } from './purchase-audit.service';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('purchase')
export class PurchaseController {
  private readonly logger = new Logger(PurchaseController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly suppliers: SupplierService,
    private readonly orders: PurchaseOrderService,
    private readonly payments: PaymentService,
    private readonly documents: PurchaseDocumentService,
    private readonly exports: PurchaseExportService,
    private readonly audit: PurchaseAuditService,
    private readonly prisma: PrismaService,
  ) {}

  // ============================================================
  // DASHBOARD KPIs
  // ============================================================

  @Get('dashboard')
  async dashboard(@Headers('authorization') authHeader: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalOrders, openOrders, partiallyPaidOrders, fullyPaidOrders,
      thisMonthCount, openSums, paidThisMonth, overdueInvoices,
    ] = await Promise.all([
      this.prisma.purchaseOrder.count({ where: { orgId } }),
      this.prisma.purchaseOrder.count({ where: { orgId, paymentStatus: 'unpaid', status: { not: 'cancelled' } } }),
      this.prisma.purchaseOrder.count({ where: { orgId, paymentStatus: 'partially_paid' } }),
      this.prisma.purchaseOrder.count({ where: { orgId, paymentStatus: 'paid' } }),
      this.prisma.purchaseOrder.count({ where: { orgId, orderDate: { gte: startOfMonth } } }),
      this.prisma.purchaseOrder.groupBy({
        by: ['currency'],
        where: { orgId, paymentStatus: { in: ['unpaid', 'partially_paid'] }, status: { not: 'cancelled' } },
        _sum: { openAmount: true },
      }),
      this.prisma.payment.groupBy({
        by: ['currency'],
        where: { orgId, paymentDate: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      this.prisma.purchaseInvoice.findMany({
        where: {
          orgId,
          dueDate: { lt: now },
          purchaseOrder: { paymentStatus: { in: ['unpaid', 'partially_paid'] }, status: { not: 'cancelled' } },
        },
        include: { purchaseOrder: { select: { id: true, orderNumber: true, openAmount: true, currency: true, supplier: { select: { companyName: true } } } } },
        orderBy: { dueDate: 'asc' },
        take: 20,
      }),
    ]);

    const topSuppliers = await this.prisma.purchaseOrder.groupBy({
      by: ['supplierId'],
      where: { orgId, status: { not: 'cancelled' } },
      _sum: { totalAmount: true },
      _count: true,
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: 5,
    });
    const supplierIds = topSuppliers.map(s => s.supplierId);
    const supplierMap = supplierIds.length
      ? await this.prisma.supplier.findMany({
          where: { id: { in: supplierIds } },
          select: { id: true, supplierNumber: true, companyName: true },
        })
      : [];
    const topSuppliersResolved = topSuppliers.map(s => ({
      ...supplierMap.find(m => m.id === s.supplierId),
      totalAmount: s._sum.totalAmount,
      orderCount: s._count,
    }));

    return {
      counts: {
        total: totalOrders,
        open: openOrders,
        partiallyPaid: partiallyPaidOrders,
        fullyPaid: fullyPaidOrders,
        thisMonth: thisMonthCount,
        overdue: overdueInvoices.length,
      },
      openByCurrency: openSums.map(s => ({ currency: s.currency, amount: s._sum.openAmount })),
      paidThisMonthByCurrency: paidThisMonth.map(s => ({ currency: s.currency, amount: s._sum.amount })),
      overdueInvoices,
      topSuppliers: topSuppliersResolved,
    };
  }

  // ============================================================
  // PRODUCTS PICKER (proxy in eigenes Module)
  // ============================================================

  @Get('products')
  async pickProducts(
    @Headers('authorization') authHeader: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    const where: any = { orgId, status: 'active' };
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
        { variants: { some: { sku: { contains: q, mode: 'insensitive' } } } },
        { variants: { some: { barcode: { contains: q, mode: 'insensitive' } } } },
      ];
    }
    const products = await this.prisma.product.findMany({
      where,
      orderBy: { title: 'asc' },
      take: Math.min(parseInt(limit || '50', 10), 200),
      include: {
        variants: {
          select: {
            id: true, title: true, sku: true, barcode: true,
            price: true, cogs: true, cogsCurrency: true, vatRate: true,
            inventoryQuantity: true,
          },
        },
      },
    });
    return products;
  }

  // ============================================================
  // SUPPLIERS
  // ============================================================

  @Get('suppliers')
  async listSuppliers(
    @Headers('authorization') authHeader: string,
    @Query('search') search?: string,
    @Query('status') status?: 'active' | 'inactive',
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.suppliers.list(orgId, { search, status });
  }

  @Get('suppliers/:id')
  async getSupplier(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.suppliers.get(orgId, id);
  }

  @Post('suppliers')
  async createSupplier(
    @Headers('authorization') authHeader: string,
    @Body() body: SupplierInput,
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.suppliers.create(orgId, userId, body);
  }

  @Put('suppliers/:id')
  async updateSupplier(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: Partial<SupplierInput>,
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.suppliers.update(orgId, userId, id, body);
  }

  @Delete('suppliers/:id')
  async deleteSupplier(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.suppliers.remove(orgId, userId, id);
  }

  // ============================================================
  // ORDERS
  // ============================================================

  @Get('orders')
  async listOrders(
    @Headers('authorization') authHeader: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('supplierId') supplierId?: string,
    @Query('createdById') createdById?: string,
    @Query('currency') currency?: string,
    @Query('hasDocument') hasDocument?: 'yes' | 'no',
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('sort') sort?: string,
    @Query('dir') dir?: 'asc' | 'desc',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.orders.list(orgId, {
      search, status, paymentStatus, supplierId, createdById, currency, hasDocument, from, to, sort, dir,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('orders/:id')
  async getOrder(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.orders.get(orgId, id);
  }

  @Post('orders')
  async createOrder(@Headers('authorization') authHeader: string, @Body() body: PoInput) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.orders.create(orgId, userId, body);
  }

  @Put('orders/:id')
  async updateOrder(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: Partial<PoInput>,
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.orders.update(orgId, userId, id, body);
  }

  @Patch('orders/:id/status')
  async setOrderStatus(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: { status: 'draft' | 'ordered' | 'received' | 'cancelled' },
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    if (body.status === 'cancelled') assertCanCancel(role);
    else assertCanWrite(role);
    return this.orders.setStatus(orgId, userId, id, body.status);
  }

  @Delete('orders/:id')
  async deleteOrder(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanCancel(role);
    return this.orders.remove(orgId, userId, id);
  }

  @Get('orders/:id/audit')
  async orderAudit(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.audit.listForOrder(orgId, id);
  }

  // ============================================================
  // INVOICES
  // ============================================================

  @Post('orders/:id/invoices')
  async addInvoice(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: InvoiceInput,
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.orders.addInvoice(orgId, userId, id, body);
  }

  @Delete('invoices/:invoiceId')
  async deleteInvoice(
    @Headers('authorization') authHeader: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.orders.removeInvoice(orgId, userId, invoiceId);
  }

  // ============================================================
  // PAYMENTS
  // ============================================================

  @Get('orders/:id/payments')
  async listPayments(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.payments.list(orgId, id);
  }

  @Post('orders/:id/payments')
  async addPayment(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: PaymentInput,
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.payments.create(orgId, userId, id, body);
  }

  @Put('payments/:paymentId')
  async updatePayment(
    @Headers('authorization') authHeader: string,
    @Param('paymentId') paymentId: string,
    @Body() body: Partial<PaymentInput>,
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.payments.update(orgId, userId, paymentId, body);
  }

  @Delete('payments/:paymentId')
  async deletePayment(
    @Headers('authorization') authHeader: string,
    @Param('paymentId') paymentId: string,
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.payments.remove(orgId, userId, paymentId);
  }

  // ============================================================
  // DOCUMENTS
  // ============================================================

  @Get('orders/:id/documents')
  async listDocuments(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.documents.list(orgId, id);
  }

  @Post('orders/:id/documents')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 25 * 1024 * 1024, files: 1 }, // 25 MB
  }))
  async uploadDocument(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @UploadedFile() file: any,
    @Body('documentType') documentType?: string,
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    if (!file) throw new BadRequestException('Keine Datei empfangen (Formular-Feld "file" fehlt)');
    const type = (documentType || 'other') as any;
    return this.documents.upload(orgId, userId, file, id, type);
  }

  @Delete('documents/:docId')
  async deleteDocument(
    @Headers('authorization') authHeader: string,
    @Param('docId') docId: string,
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.documents.remove(orgId, userId, docId);
  }

  // ============================================================
  // EXPORT
  // ============================================================

  @Get('export/:type')
  async exportCsv(
    @Headers('authorization') authHeader: string,
    @Param('type') type: string,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('supplierId') supplierId: string | undefined,
    @Query('status') status: string | undefined,
    @Query('paymentStatus') paymentStatus: string | undefined,
    @Query('skr') skr: 'SKR03' | 'SKR04' | undefined,
    @Query('preview') preview: string | undefined,
    @Res() res: Response,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    const validTypes = ['master', 'items', 'payments', 'invoices', 'open', 'tax', 'datev'];
    if (!validTypes.includes(type)) {
      throw new BadRequestException(`Unbekannter Export-Typ: ${type}`);
    }
    const { filename, csv } = await this.exports.build(orgId, type as any, {
      from, to, supplierId, status, paymentStatus, skr,
    });

    if (preview === '1') {
      const lines = csv.split('\r\n');
      const head = lines.slice(0, 11).join('\r\n'); // 1 header + 10 rows
      return res.json({ filename, preview: head, totalLines: lines.length - 1 });
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csv);
  }
}
