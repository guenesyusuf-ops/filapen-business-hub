import { Controller, Get, Headers, Logger } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { extractAuthContext } from './auth-context';

@Controller('shipping')
export class ShippingController {
  private readonly logger = new Logger(ShippingController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('dashboard')
  async dashboard(@Headers('authorization') authHeader: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    const [openOrders, activeShipments, labelsToday, deliveredThisMonth, carriers] = await Promise.all([
      // Open orders needing shipment: status=open AND fulfillment=unfulfilled AND no shipment yet
      this.prisma.order.count({
        where: {
          orgId,
          status: 'open',
          fulfillmentStatus: 'unfulfilled',
          shipments: { none: {} },
        },
      }),
      this.prisma.orderShipment.count({
        where: {
          orgId,
          status: { in: ['label_created', 'handed_to_carrier', 'in_transit', 'out_for_delivery', 'ready_for_pickup'] },
        },
      }),
      this.prisma.orderShipmentLabel.count({
        where: {
          shipment: { orgId },
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      this.prisma.orderShipment.count({
        where: {
          orgId,
          status: 'delivered',
          deliveredAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
      this.prisma.carrierAccount.count({ where: { orgId, status: 'active' } }),
    ]);
    return {
      counts: { openOrders, activeShipments, labelsToday, deliveredThisMonth, carriers },
    };
  }
}
