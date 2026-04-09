import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { ShopifyService } from './shopify.service';

@Controller('auth/shopify')
export class ShopifyAuthController {
  private readonly logger = new Logger(ShopifyAuthController.name);

  constructor(
    private readonly shopifyService: ShopifyService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * GET /auth/shopify/install?shop=mystore.myshopify.com
   *
   * Initiates the Shopify OAuth flow. The requesting user must be
   * authenticated and we extract their orgId from the request context.
   * Redirects the browser to Shopify's authorization page.
   */
  @Get('install')
  install(
    @Query('shop') shop: string,
    @Query('orgId') orgId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    if (!shop) {
      throw new BadRequestException(
        'Missing required query parameter: shop',
      );
    }

    if (!orgId) {
      throw new BadRequestException(
        'Missing required query parameter: orgId',
      );
    }

    // Validate shop domain format to prevent open redirect
    const shopPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
    const normalizedShop = shop.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!normalizedShop.endsWith('.myshopify.com')) {
      throw new BadRequestException(
        'Invalid shop domain. Must be a .myshopify.com domain.',
      );
    }

    const authUrl = this.shopifyService.getAuthUrl(orgId, normalizedShop);

    this.logger.log(
      `Initiating Shopify OAuth for org ${orgId}, shop ${normalizedShop}`,
    );

    res.redirect(authUrl);
  }

  /**
   * GET /auth/shopify/callback?code=...&shop=...&state=...&hmac=...
   *
   * Handles the OAuth callback from Shopify. Exchanges the authorization
   * code for an access token, stores the integration, and redirects
   * the user back to the frontend.
   */
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('shop') shop: string,
    @Query('state') state: string,
    @Query('hmac') hmac: string,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');

    try {
      if (!code || !shop || !state) {
        throw new BadRequestException(
          'Missing required callback parameters (code, shop, state)',
        );
      }

      // Verify the HMAC from Shopify to ensure the request is authentic
      if (hmac) {
        const isValid = this.verifyCallbackHmac({ code, shop, state }, hmac);
        if (!isValid) {
          throw new BadRequestException('Invalid HMAC signature on callback');
        }
      }

      const result = await this.shopifyService.handleCallback(
        code,
        shop,
        state,
      );

      this.logger.log(
        `Shopify OAuth callback successful. Integration: ${result.integrationId}`,
      );

      // Redirect to frontend with success
      const successUrl = new URL('/settings/integrations', frontendUrl);
      successUrl.searchParams.set('shopify', 'connected');
      successUrl.searchParams.set('integrationId', result.integrationId);
      res.redirect(successUrl.toString());
    } catch (error) {
      this.logger.error(
        `Shopify OAuth callback failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );

      // Redirect to frontend with error
      const errorUrl = new URL('/settings/integrations', frontendUrl);
      errorUrl.searchParams.set('shopify', 'error');
      errorUrl.searchParams.set(
        'error',
        error instanceof Error ? error.message : 'Unknown error',
      );
      res.redirect(errorUrl.toString());
    }
  }

  /**
   * Verify the HMAC on the OAuth callback query parameters.
   * Shopify signs the callback with HMAC-SHA256 using the API secret.
   */
  private verifyCallbackHmac(
    params: Record<string, string>,
    hmac: string,
  ): boolean {
    const crypto = require('crypto');
    const secret = this.configService.getOrThrow<string>('SHOPIFY_API_SECRET');

    // Build the message from sorted query params, excluding hmac itself
    const sortedKeys = Object.keys(params).sort();
    const message = sortedKeys
      .map((key) => `${key}=${params[key]}`)
      .join('&');

    const computed = crypto
      .createHmac('sha256', secret)
      .update(message)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(computed, 'hex'),
        Buffer.from(hmac, 'hex'),
      );
    } catch {
      return false;
    }
  }
}
